import { Component } from 'react'

/**
 * Keeps one failed page from blanking the whole app. Dexie surfaces write
 * failures through the live query, which rethrows them during render, so a
 * single bad write would otherwise take the shell down with it.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info)
  }

  componentDidUpdate(prevProps) {
    // A new route gets a clean slate.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="bfh-page">
        <section className="bfh-card">
          <span className="bfh-micro">Something went wrong</span>
          <p className="bfh-boundary__note">
            {this.state.error.message ?? 'This page could not be displayed.'}
          </p>
          <button
            type="button"
            className="bfh-btn-ghost bfh-boundary__retry"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </section>
      </div>
    )
  }
}
