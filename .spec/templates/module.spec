---
paths: /test/**/*Module*.ts
---
~[import**]

export class *Module extends ComponentModule {
  |[
    domain = {}
    <> domain = {
      *: use*(*)**
    }
  ]

  |[
    application = {}
    <> application = {
      *: use*(*)**
    }
  ]

  |[
    infrastructure = {}
    <> infrastructure = {
      *: use*(*)**
    }
  ]

  ~[constructor(props: Record<string, any>) {
    super(props)
    ~[**[3]!![props]]
  }]

  |[
    effects() {}
    <> effects() {
      **
    }
  ]

  |[
    onLoad() {}
    <> onLoad() {
      **
    }
  ]

  |[
    onMount() {}
    <> onMount() {
      **
    }
  ]

  |[
    onDestroy() {}
    <> onDestroy() {
      **
    }
  ]
}
