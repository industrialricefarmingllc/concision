import { ComponentModule } from "../src/component-module"
import { useUser } from "../src/user"

export class DummyModule extends ComponentModule {
  domain = {
    user: useUser()
  }

  application = {}

  infrastructure = {}

  constructor(props: Record<string, any>) {
    super(props)
    this.props = props
  }

  effects() {}

  onLoad() {}

  onMount() {}

  onDestroy() {}
}
