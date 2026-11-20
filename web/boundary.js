/**
 * Catches an error thrown while the page draws, so the panel says what broke and offers a reload
 * (which also picks up modules changed by an update) instead of going blank.
 */
export function createBoundary(React) {
  const h = React.createElement
  return class PageBoundary extends React.Component {
    constructor(props) {
      super(props)
      this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
      return { error }
    }

    componentDidCatch(error, info) {
      console.error('[media-hub] the page crashed: %s', error?.message, info?.componentStack ?? '')
    }

    render() {
      const { error } = this.state
      if (error === null) return this.props.children
      const { t } = this.props
      return h('div', { className: 'vsync-crash', role: 'alert' },
        h('p', null, t('page.crashed')),
        h('p', { className: 'vsync-error' }, String(error?.message ?? error)),
        h('button', { type: 'button', className: 'vsync-crash-reload', onClick: () => location.reload() }, t('page.reload')))
    }
  }
}
