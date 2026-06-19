import { ComponentModule } from "../src/component-module"

export class DummyModule extends ComponentModule {
  domain = {}

  application = {}

  infrastructure = {}

  constructor(props: Record<string, any>) {
    super(props)
    const input = "name"
    this.value = input
  }

  effects() {}

  onLoad() {}

  onMount() {}

  onDestroy() {}
}
