import {Kek} from "./src"
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
