import lodash = require("lodash")
import {Lodashify} from "./lodashify"
import {Atom, autorun} from "mobx"

export interface KekModel {}

export class BaseKek<T> extends Lodashify<T> {
	_models: T[] = []

	add(model: T): this {
		this._models.push(model)
		return this
	}

	remove(model: T): this {
		const ix = this._models.indexOf(model)
		if (ix > -1) {
			this._models.splice(ix, 1)
		}
		return this
	}
}

export class Kek<T extends KekModel> extends BaseKek<T> {
	_atom: Atom = null

	observe(fn: (r) => any): any {
		return autorun(fn)
	}

	@observed get models() {
		return this._models
	}

	constructor(_models: T[] = [], onObserved?: () => void, onUnobserved?: () => void) {
		super(() => { this._atom.reportObserved() })

		this._atom = new Atom(kuid(), onObserved, onUnobserved)

		_models.filter(Boolean).forEach(model => {
			this.add(model)
		})
	}

	@changed add(model: T) {
		super.add(model)
		return this
	}

	@changed remove(model: T) {
		super.remove(model)
		return this
	}
}

export function changed(target: any, key: any, descriptor: TypedPropertyDescriptor<any>) {
	const sup = descriptor.set || descriptor.value

	const fn = function(...args) {
		const res = sup.apply(this, args)
		this._atom.reportChanged()
		return res
	}

	if (lodash.isFunction(descriptor.set)) {
		descriptor.set = fn
	} else if (lodash.isFunction(descriptor.value)) {
		descriptor.value = fn
	}

	return descriptor
}

export function observed(target: any, key: any, descriptor: TypedPropertyDescriptor<any>) {
	const sup = descriptor.get || descriptor.value

	const fn = function() {
		this._atom.reportObserved()
		return sup.apply(this)
	}

	if (lodash.isFunction(descriptor.get)) {
		descriptor.get = fn
	} else if (lodash.isFunction(descriptor.value)) {
		descriptor.value = fn
	}

	return descriptor
}

function kuid() {
	return `kek-${Math.random().toString(16).split("0.")[1]}`
}
