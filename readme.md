# kek

observable set (using [mobx](https://github.com/mobxjs/mobx)) that produces rows of [rfc6902](https://tools.ietf.org/html/rfc6902) patches (using [fast-json-patch](https://github.com/Starcounter-Jack/JSON-Patch)) as readable stream.

[![Build Status](https://travis-ci.org/tetsuo/kek.svg?branch=master)](http://travis-ci.org/tetsuo/kek)
[![NPM version](https://badge.fury.io/js/kek.svg)](http://badge.fury.io/js/kek)

# example

```js
import {Kek} from "kek"
import assert = require("assert")

type IModel = {
	id: string
	n: number
}

const models: IModel[] = [
	{ id: "foo", n: 10 },
	{ id: "bar", n: 5 }
]

const kek = new Kek<IModel>(models)

function nSum(models: IModel[]): number {
	return kek.children.reduce<number>((acc, x) => {
		acc += x.n
		return acc
	}, 0)
}

const reads = kek.observe((value, r) => {
	assert(kek.children === value)

	if (nSum(kek.children) === 22) {
		r.dispose()
	}
})

reads.on("data", changes => {
	console.log(changes)
})

const baz = { id: "baz", n: 1 }

kek.add(baz)

kek.batch(() => {
	baz.n = 5
	kek.add({ id: "qux", n: 0 })
	kek.add({ id: "quux", n: 0 })
})

kek.children.forEach(model => {
	if (model.id !== "baz") {
		model.n += 1
	}
})

```

outputs:

```
[ { op: 'add', path: '/2', value: { id: 'baz', n: 1 } } ]
[ { op: 'replace', path: '/2/n', value: 5 },
  { op: 'add', path: '/3', value: { id: 'qux', n: 0 } },
  { op: 'add', path: '/4', value: { id: 'quux', n: 0 } } ]
[ { op: 'replace', path: '/0/n', value: 11 } ]
[ { op: 'replace', path: '/1/n', value: 6 } ]
```

# api

```js
import {Kek} from "kek" 
```

## const k = new kek.Kek<T>(models?: T[])

## k.add(model: T)

## k.remove(model: T)

## k.batch(fn: () => void)

## const stream = k.observe((value: T[], r: kek.IDisposer) => void)

## k.children: T[]
