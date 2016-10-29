/**
 * lodashify
 *
 * Mix-in lodash methods, no typings tho.
 */

import {Atom, observable} from "mobx"
import lodash = require("lodash")

const _methods = [
	"forEach",
	"each",
	"map",
	"reduce",
	"reduceRight",
	"find",
	"filter",
	"reject",
	"every",
	"some",
	"invoke",
	"max",
	"min",
	"toArray",
	"size",
	"first",
	"head",
	"take",
	"initial",
	"rest",
	"tail",
	"drop",
	"last",
	"without",
	"difference",
	"indexOf",
	"shuffle",
	"lastIndexOf",
	"isEmpty",
	"chain",
	"sample"
]

const _attr_methods = [
	"groupBy",
	"countBy",
	"sortBy",
	"keyBy"
]

export class Lodashify<T> {
	_models: T[] = null

	constructor(onObserve?: () => void, methods?: string[], attr_methods?: string[]) {
		const proto = this

		methods = methods || _methods
		attr_methods = attr_methods || _attr_methods

		lodash.each(methods, function(method) {
			if (!lodash[method] || proto.hasOwnProperty(method)) {
				return
			}

			proto[method] = function() {
				const args = Array.prototype.slice.call(arguments)
				args.unshift(this._models)

				if (typeof onObserve === "function") {
					onObserve();
				}

				return lodash[method].apply(lodash, args)
			}
		})

		lodash.each(attr_methods, function(method) {
			if (proto.hasOwnProperty(method)) {
				return
			}

			proto[method] = function(value, context) {
				if (typeof onObserve === "function") {
					onObserve();
				}

				const iterator = lodash.isFunction(value)
					? value
					: function(model) {
						if (lodash.isFunction(model.get)) {
							return model.get(value)
						} else {
							return model[value]
						}
					}

					return lodash[method](this._models, iterator, context)
			}
		})

	}
}