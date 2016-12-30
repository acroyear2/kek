import test = require("tape")
import {Kek} from "../kek"
import mobx = require("mobx")
import fastjsonpatch = require("fast-json-patch")

interface FooKek {
    name: string
}

test("observe add/remove", t => {
    const m = new Kek<FooKek>()

    const expected = [
        [],
        [ { name: "555" } ],
        [],
        [ { name: "quux" } ]
    ]

    t.plan(expected.length+1)

    let i = -1
    m.observe((value, r) => {
        t.deepEqual(value, expected[++i])

        if (i === expected.length-1) {
            t.equal(value, m.children)
            r.dispose()
        }
    })

    m.add(expected[1][0])
    m.remove(expected[1][0])
    m.add(expected[3][0])
})

test("observe add/remove transaction", t => {
    const m = new Kek<FooKek>()

    const expected = [
        [],
        [ { name: "555" } ],
        [ { name: "quux" }, { name: "qux" } ]
    ]

    t.plan(expected.length)

    let i = -1
    mobx.autorun(r => {
        t.deepEqual(m.children, expected[++i])

        if (i === expected.length-1) {
            r.dispose()
        }
    })

    m.add(expected[1][0])

    m.batch(() => {
        m.remove(expected[1][0])
        m.add(expected[2][0])
        m.add(expected[2][1])
    })
})

test("observe change on children", t => {
    let x = { name: "bar" }

    const m = new Kek<FooKek>([ x ])

    const expected = [ 
        "bar", "baz", "qux"
    ]

    t.plan(expected.length)
    // t.timeoutAfter(500)

    let i = -1
    mobx.autorun(r => {
        t.deepEqual(m.children[0].name, expected[++i])
        if (i === expected.length - 1) {
            r.dispose()
        }
    })

    x.name = "baz"

    m.batch(() => {
        x.name = "quux"
        x.name = "qux"
    })
})

test("read patches & emit stream end", t => {
    let x = { name: "bar" }

    const m = new Kek<FooKek>([ x ])

    const expected = [ 
        [ { op: "replace", path: "/0/name", value: "baz" } ],
        [ { op: "replace", path: "/0/name", value: "qux" } ]
    ]

    t.plan(expected.length + 2)

    const s = m.observe()

    let i = -1
    s.on("data", data => {
        t.deepEqual(data, expected[++i])
        if (i === expected.length - 1) {
            s.emit("end")
            process.nextTick(() => {
                t.equal(m._streams.length, 0)
                process.nextTick(() => { // cleanup in next tick
                    t.equal(m._multiWriter, null)
                })
            })
        }
    })

    x.name = "baz"

    m.batch(() => {
        x.name = "quux"
        x.name = "qux"
    })

})

test("observe changes & emit dispose", t => {
    let x = { name: "bar" }

    const m = new Kek<FooKek>([ x ])

    const expected = [ 
        [ { name: "bar" } ],
        [ { name: "baz" } ],
        [ { name: "qux" } ]
    ]

    let i = -1
    m.observe((value, r) => {
        t.deepEqual(value, expected[++i])
        if (i === expected.length - 1) {
            r.dispose()

            process.nextTick(() => {
                t.equal(m._streams.length, 0)
                process.nextTick(() => { // cleanup in next tick
                    t.equal(m._multiWriter, null)
                    t.end()
                })
            })
        } else if (i === 0) {
            t.equal(m._streams.length, 1)
            t.notEqual(m._multiWriter, null || undefined)
        }
    })

    x.name = "baz"

    m.batch(() => {
        x.name = "quux"
        x.name = "qux"
    })
})

test("multiple streams", t => {
    const x = { name: "bar" }
    const expected = [ 
        [ { op: "replace", path: "/0/name", value: "baz" } ],
        [ { op: "replace", path: "/0/name", value: "qux" } ],
        [ { op: "add", path: "/1", value: { name: "quu" } } ]
    ]

    const m = new Kek<FooKek>([ x ])
    t.plan(expected.length * 2)

    const s1 = m.observe()
    const s2 = m.observe()
    let i1 = -1, i2 = -1

    s1.on("data", patch => {
        ++i1
        t.deepEqual(patch, expected[i1])
        if (i1 === expected.length - 1) {
            s1.emit("end")
        }
    })

    s2.on("data", patch => {
        ++i2
        t.deepEqual(patch, expected[i2])
        if (i2 === expected.length - 1) {
            s2.emit("end")
        }
    })

    x.name = "baz"
    x.name = "qux"

    const y = { name: "quu" }
    m.add(y)

})

test("multiple streams & observers", t => {
    const x = { name: "bar" }

    const expected0 = [ 
        [ { name: "bar" } ],
        [ { name: "baz" } ],
        [ { name: "qux" } ],
        [ { name: "qux" }, { name: "quu" } ],
        [ { name: "boop" }, { name: "beep" } ]
    ]

    const expected1 = [ 
        [ { op: "replace", path: "/0/name", value: "baz" } ],
        [ { op: "replace", path: "/0/name", value: "qux" } ],
        [ { op: "add", path: "/1", value: { name: "quu" } } ],
        [ { op: "replace", path: "/1/name", value: "beep" }, { op: "replace", path: "/0/name", value: "boop" } ]
    ]

    const m = new Kek<FooKek>([ x ])

    t.plan((expected0.length * 2) + expected1.length * 2)
    // t.timeoutAfter(1000)

    let i0 = -1, i01 = -1, i1 = -1, i11 = -1

    const s0 = m.observe((value, r) => {
        ++i0
        t.deepEqual(value, expected0[i0])
        if (i0 === expected0.length - 1) {
            process.nextTick(() => {
                r.dispose()
            })
        }
    })

    const s1 = m.observe((value, r) => {
        ++i01
        t.deepEqual(value, expected0[i01])
    })

    s0.on("data", patch => {
        ++i1
        t.deepEqual(patch, expected1[i1])
    })

    s1.on("data", patch => {
        ++i11
        t.deepEqual(patch, expected1[i11])
        if (i11 === expected1.length - 1) {
            s1.emit("end")
        }
    })

    x.name = "baz"
    x.name = "qux"

    const y = { name: "quu" }
    m.add(y)

    m.batch(() => {
        y.name = "beep"
        x.name = "boop"
    })

})

const arrayops = [
  { // 0
    val: [ 1, 2, 3 ],
    op: function (x) {
      x.splice(0, 0, 4, 5)
    },
    expected: [ 4, 5, 1, 2, 3 ]
  },
  { // 1
    val: [],
    op: function (x) {
      x.splice(15, 15, 4, 5)
    },
    expected: [ 4, 5 ]
  },
  { // 2
    val: [],
    op: function (x) {
      x.push(3)
      x.push(4, 5)
      x.splice(1, 1, 42, 8)
    },
    expected: [ 3, 42, 8, 5 ]
  },
  { // 3
    val: [ 3, 4 ],
    op: function (x) {
      x.push(5)
      x.shift()
      x.shift()
    },
    expected: [ 5 ]
  },
  { // 4
    val: [ 1, 2, 3 ],
    op: function (x) {
      x.splice(0, 2)
    },
    expected: [ 3 ]
  },
  { // 5
    val: [ 3, 4, 5 ],
    op: function (x) {
      x[0] = 5
      x[2] = 42
      x.splice(1, 1)
    },
    expected: [ 5, 42 ]
  },
  { // 6
    val: [ 3, 4, 5 ],
    op: function (x) {
      x.unshift(1, 2)
      x[2] = 6
    },
    expected: [ 1, 2, 6, 4, 5 ]
  },
  { // 7
    val: [ 3, 4, 5 ],
    op: function k(x) {
      x.splice(1, 1, [])
      x[1].push([4, 1, 2])
      x[1][0].shift()
      x[2] = 6
      x[1][0].splice(1, 1, [ 7, 3 ])
      x[1][0][1][1] = 4
    },
    expected: [ 3, [ [ 1, [ 7, 4 ] ] ], 6 ]
  },
  { // 8
    val: [ 1 ],
    op: function (a) {
      a.splice(1, 0, [2, [] ])
      a[1][1] = [3,4]
      a[1][1] = [ 3 ]
      a[1][1].shift()
    },
    expected: [ 1, [ 2, [] ] ]
  },
  { // 9
    val: [],
    op: function (a) {
      a.push({ a: 1 })
      a[0].a = 2
    },
    expected: [ { a: 2 } ]
  },
  { // 10
    val: [],
    op: function (a) {
      a.push({ a: { b: [ 3, 4, 5 ]} })
      a[0].a.b.splice(0, 3, 42, 2, 1)
    },
    expected: [ { a: { b: [ 42, 2, 1 ]} } ]
  },
  { // 11
    val: [{ c: 2 }],
    op: function (a) {
      a.splice(1, 0, 4, 5)
      a[0].c = 3
      a.pop()
    },
    expected: [ { c: 3 }, 4 ]
  },
  { // 12
    val: [5],
    op: function (a) {
      a.unshift(4)
      a[0] = { a: 2, b: { c: [ 2, 3 ] } }
      a[0].b.c[1] = { d: { e: 2 }}
      a[0].b.c[1].d.e = 5
    },
    expected: [ { a: 2, b: { c: [2, { d: { e: 5 }}]}}, 5 ]
  },
  { // 13
    val: [ { b: { c: 555, d: [ 1, 2, 3 ]}}],
    op: function (a) {
      a[0].b.c = []
      a[0].b.c.push(4, 2)
      a[0].b.d.splice(1, 0, 4)
    },
    expected: [ { b: { c: [4,2], d: [ 1, 4, 2, 3 ]} } ]
  },
  { // 14
    val: [],
    op: function (a) {
      a.splice(0, 0, { b: 2 })
      a.unshift([ { k: { r: [0] } } ])
      a[0][0].k.r.push(3)
    },
    expected: [[{"k":{"r":[0,3]}}],{"b":2}]
  },
  { // 15
    val: [ { b: [] } ],
    op: function (a) {
      a.unshift({ k: [ "bla", 5, 3, { r: [ 1, 2, { z: 3 }]}]})
      a[0].k[1] = 42
      a[0].k.splice(2, 1)
      a[1].b.unshift({ x: 555, y: "bla" })
      a[0].k[2].r.unshift({ a: [4,5,3]})
      a[0].k[2].r[0].a.push(52)
      a[0].k[2].r[0].a.splice(1, 3, 7)
    },
    expected: [{"k":["bla",42,{"r":[{"a":[4,7]},1,2,{"z":3}]}]},{"b":[{"x":555,"y":"bla"}]}]
  }
]

test("array ops", t=> {
    // t.timeoutAfter(1000)
    let fixtures = arrayops
    // let fixtures = arrayops.slice(0, 9)
    // fixtures = [ arrayops[7] ]

    t.plan(fixtures.length)

    fixtures.forEach((f, ix) => {
        const x = { v: f.val }
        let x1 = mobx.toJSON([x])
        const m = new Kek([ x ])
        const s = m.observe()

        const allPatches = []

        s.on("data", patches => {
            allPatches.push(patches)
        })

        s.on("end", () => {
            process.nextTick(() => {
                allPatches.forEach(patch => {
                    fastjsonpatch.apply(x1, patch)
                })
                t.comment("arrayops-" + ix)
                t.deepEqual(x1[0].v, f.expected)
            })
        })

        f.op(x.v)
        s.emit("end")
    })
})
