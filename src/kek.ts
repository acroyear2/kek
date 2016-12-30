import fastjsonpatch = require("fast-json-patch")
import mobx = require("mobx")
import through = require("through2")
const multi = require("multi-write-stream")
const readonly = require("read-only-stream")
const eos = require("end-of-stream")

const debug = require("debug")("kek")

export type IMultiWriteStream = {
	add: (stream: NodeJS.ReadWriteStream) => void
	remove: (stream: NodeJS.ReadWriteStream) => void
	destroy: () => void
}

export type IDisposer = {
	dispose: () => void
}

export class Kek<T> {
	_atom: mobx.Atom = new mobx.Atom
	_multiWriter: NodeJS.WritableStream & IMultiWriteStream = null

	@mobx.observable _streams: NodeJS.ReadWriteStream[] = mobx.asFlat([])

	_children: T[] = []
	@mobx.observable _shadow: T[] = []

	_prevChildren: T[] = null

	@observed get children(): T[] {
		return this._children
	}

	constructor(children: T[] = []) {
		mobx.transaction(() => {
			children.filter(Boolean).forEach(model => {
				this.add(model)
			})
		})
	}

	@changed add(value: T): this {
		this._children.push(value)
		this._shadow.push(value)
		return this
	}

	@changed remove(value: T): this {
		const ix = this._children.indexOf(value)
		if (ix > -1) {
			this._children.splice(ix, 1)
			this._shadow.splice(ix, 1)
		}
		return this
	}

	_flush() {
		const current = mobx.toJSON(this.children)
		const prev = this._prevChildren

		const patches = fastjsonpatch.compare(prev, current)

		if (patches.length) {
			debug("emit patch %O (streams len: %d)", patches, this._streams.length)
			this._multiWriter.write(patches as any)
			this._prevChildren = current
			this._atom.reportObserved()
		}
	}

	observe(fn?: (value: T[], r: IDisposer) => any): NodeJS.ReadWriteStream {
		const tr = through.obj()
		this._streams.push(tr)

		debug("init stream #%d", this._streams.length - 1)

		if (this._streams.length === 1 && !this._multiWriter) {
			debug("init multi-writer")
			this._multiWriter = multi.obj([], { autoDestroy: false })
			this._prevChildren = mobx.toJSON(this._children)

			mobx.when(() => {
				const disposed = (this._streams.length === 0)
				debug("disposed", disposed)
				if (!disposed) {
					debug("calculate changes")
					this._flush()
				}
				return disposed
			}, () => {
				process.nextTick(() => {
					debug("dispose multi-writer (s: %s)", this._streams.length)
					this._multiWriter.destroy()
					this._multiWriter = null
				})
			})
		}

		this._multiWriter.add(tr)

		let _r

		const ro = readonly(tr)

		eos(ro, er => {
			const ix = this._streams.indexOf(tr)
			if (er) {
				debug(`stream #%d closed prematurely (er: %s)`, ix, er.message)
			}

			process.nextTick(() => {
				const ix = this._streams.indexOf(tr)
				if (ix !== -1) {
					debug("dispose stream (%d) (eos)", this._streams.length)

					this._streams.splice(ix, 1)
					this._multiWriter.remove(tr)
				}

				if (typeof _r === "function") {
					debug("dispose observer #%d (eos)", ix)
					_r()
				}
			})
		})

		if (fn) {
			_r = mobx.autorun(r => {
				fn(this.children, {
					dispose: () => {
						this._flush()

						const ix = this._streams.indexOf(tr)

						debug("dispose stream (%d) (autorun)", this._streams.length)
						if (ix !== -1) {
							this._streams.splice(ix, 1)
							this._multiWriter.remove(tr)
						}

						debug("dispose observer #%d (autorun)", ix)
						r.dispose()
					}
				})
			})
		}

		return ro
	}

	batch(fn: () => any): void {
		return void mobx.transaction(fn)
	}
}

export function changed(target: any, key: any, descriptor: TypedPropertyDescriptor<any>) {
	const sup = descriptor.set || descriptor.value

	const fn = function(...args) {
		const res = sup.apply(this, args)
		const self = (<Kek<any>>this)
		//debug("report changed (%s)", key)
		self._atom.reportChanged()
		return res
	}

	if (typeof descriptor.set === "function") {
		descriptor.set = fn
	} else if (typeof descriptor.value === "function") {
		descriptor.value = fn
	}

	return descriptor
}

export function observed(target: any, key: any, descriptor: TypedPropertyDescriptor<any>) {
	const sup = descriptor.get || descriptor.value

	const fn = function() {
		const self = (<Kek<any>>this)
		//debug("report observed (%s)", key)
		self._atom.reportObserved()
		return sup.apply(this)
	}

	if (typeof descriptor.get === "function") {
		descriptor.get = fn
	} else if (typeof descriptor.value === "function") {
		descriptor.value = fn
	}

	return descriptor
}
