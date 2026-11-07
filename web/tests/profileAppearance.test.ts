import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { selectedProfileGradient, profileAvatarAppearance } from '../src/utils/profileAppearance.ts'

const green = 'linear-gradient(135deg, #10b981, #059669)'
const blue = 'linear-gradient(135deg, #6366f1, #0ea5e9)'

test('a saved gradient is the only selected preset after reopening', () => {
  assert.equal(selectedProfileGradient(blue, false, green), blue)
  assert.notEqual(selectedProfileGradient(blue, false, green), green)
})

test('an image selection does not select a gradient preset', () => {
  assert.equal(selectedProfileGradient(blue, true, green), undefined)
  assert.equal(selectedProfileGradient('/uploads/image.png', false, green), undefined)
})

test('an empty profile selects its default gradient', () => {
  assert.equal(selectedProfileGradient('', false, green), green)
})

test('saved avatar gradients render as a background with initials instead of an image URL', () => {
  assert.deepEqual(profileAvatarAppearance(blue, 'Alice'), { background: blue, initial: 'A' })
  assert.equal(profileAvatarAppearance('/uploads/avatar.png', 'Alice'), undefined)
})
