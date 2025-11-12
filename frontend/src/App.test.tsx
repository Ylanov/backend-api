import { render, screen } from '@testing-library/react'
import React from 'react'

function Dummy() {
  return <h1>hello</h1>
}

test('renders hello', () => {
  render(<Dummy />)
  expect(screen.getByText(/hello/i)).toBeInTheDocument()
})
