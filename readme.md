# kek

observable set (using [mobx](https://github.com/mobxjs/mobx)) that proxies to [lodash](https://github.com/lodash/lodash).

[![Build Status](https://travis-ci.org/tetsuo/kek.svg?branch=master)](http://travis-ci.org/tetsuo/kek)
[![NPM version](https://badge.fury.io/js/kek.svg)](http://badge.fury.io/js/kek)

# example

So, let's say you have this `Collection` class that looks like this:

```js
class Collection<T> {
	_models: T[] = []

	add(model: T) {
		this._models.push(model)
		return this
	}
}
```

There's not much you can do with this class except for adding `T`s right? Well, `kek` changes this!

With almost no effort, you can turn this simple `Collection` class to an observable with some subset of lodash methods mixed-in (no typings yet tho). Here's how you do it:

```js
import {Kek} from "kek"

class Collection<T extends number> extends Kek<T> {}
```

That's pretty much it. `.add(model: T)` and `.remove(model: T)` are provided by default.

```js
const collection = new Collection
collection.add(1)
collection.add(2)
collection.add(3)
```

## mixes in lodash methods

A `Kek` by default proxies to lodash4 to provide some utility methods, unless those methods are overridden:

```js
const _ = collection as any /* lodash typings are not there yet. prs are welcome */
console.log(_.filter(d => { return d > 2 })) /* outputs: [3] */
```

(See: [`lodashify.ts`](./src/lodashify.ts) for the complete list of `lodash` methods mixed-in)

## and it's observable!

You can also observe the `collection` for changes.

For convenience, `Kek` provides an `.observe(fn)` method which proxies to [`mobx.autorun`](https://mobxjs.github.io/mobx/refguide/autorun.html).

```js
collection.observe(r => {
	const models = collection.find(d => {
		return d > 5
	})

	console.log("number of numbers gt than 5", models.length)

	if (models.length) {
		console.log("disposing")
		r.dispose()
	}
})

collection.add(4)
collection.add(5)
collection.add(6)
collection.add(7)
collection.add(8)
```

In the above example, given function will not react to `.add()` anymore after `6` is added to the collection. This will output:

```
number of numbers gt 5: 0
number of numbers gt 5: 0
number of numbers gt 5: 0
number of numbers gt 5: 1
disposing
```

You can use your own model types, of course.

```js
export interface NamedModel {
	name: string
}

class Collection2<T extends NamedModel> extends Kek<T> {}

const defaults = [ { name: "foo" }, { name: "bar" } ]

const collection2 = new Collection2(defaults)

const dispose = collection2.observe(() => {
	console.log("num of models", collection2.models.length)
})

collection2.add({ name: "baz" })
dispose()
```

outputs:

```
num of models 2
num of models 3
```

`Kek` constructor optionally takes an array of models as its first argument. Second (`onBecomeObserved()`) and third (`onBecomeUnobserved()`) arguments are passed to the internal [`mobx.Atom`](https://mobxjs.github.io/mobx/refguide/extending.html) instance. Passing these, you can get notified of the transitions from/to an observed state.

```js
import {autorun} from "mobx"

function onObserve() {
	console.log("collection21 is being observed now")
}

function onUnobserve() {
	console.log("collection21 is not being observed atm")
}

const collection21 = new Collection2([], onObserve, onUnobserve)

const dispose2 = autorun(r => {
	console.log("collection21 models len:", collection21.models.length)
})

collection21.add(555)
dispose2()
```

outputs:

```
collection21 is being observed now
collection21 models len: 0
collection21 models len: 1
collection21 is not being observed atm
```

## advanced keks

By default `add()` and `remove()` methods report changes to `mobx`. You can override those methods, or create new ones to add custom functionality. Keep in mind that for any changes you make on the `models` you need to call `.reportChanged()` method of the internal `Atom` instance, and likewise any method/getter that reads `models` should call `_atom.reportObserved()`. 

`kek` provides `@changed` and `@observed` decorators to make this easier for you. Here's a slightly advanced `Kek` that adds an `increment()` method using `@changed`:

```js
class Collection3<T extends NamedModel & { count: number }> extends Kek<T> {
	@changed increment(name: string) {
		const _ = this as any
		const model = _.find({ name: name })

		if (model) {
			model.count++
		}
	}
}

const collection3 = new Collection3([{ name: "foo", count: 1 }])
collection3.observe(function(r) {
	const _ = collection3 as any
	const res = _.filter(d => { return d.count > 2 })

	if (res.length) {
		console.log("got model with count > 1, disposing")
		r.dispose()
	}

})

collection3.increment("foo")
collection3.increment("foo")
```