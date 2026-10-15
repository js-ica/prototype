import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  appendVoiceTranscript,
  getSpeechRecognitionConstructor,
  getVoiceErrorMessage,
} from './voiceInput.js'

test('speech recognition detection supports standard and prefixed browser APIs', () => {
  function Recognition() {}

  assert.equal(getSpeechRecognitionConstructor({ SpeechRecognition: Recognition }), Recognition)
  assert.equal(getSpeechRecognitionConstructor({ webkitSpeechRecognition: Recognition }), Recognition)
  assert.equal(getSpeechRecognitionConstructor({ SpeechRecognition: true }), null)
  assert.equal(getSpeechRecognitionConstructor(null), null)
})

test('transcripts append without changing existing typed text', () => {
  assert.deepEqual(appendVoiceTranscript('  Typed idea  ', ' spoken addition ', 4000), {
    value: '  Typed idea  spoken addition',
    exceedsLimit: false,
  })
  assert.deepEqual(appendVoiceTranscript('Typed idea\n', ' spoken addition ', 4000), {
    value: 'Typed idea\nspoken addition',
    exceedsLimit: false,
  })
  assert.deepEqual(appendVoiceTranscript('Typed idea', '', 4000), {
    value: 'Typed idea',
    exceedsLimit: false,
  })
  assert.equal(appendVoiceTranscript('1234', '56', 5).exceedsLimit, true)
})

test('speech recognition failures explain actionable fallback steps', () => {
  assert.match(getVoiceErrorMessage('not-allowed', 'idea'), /permission/)
  assert.match(getVoiceErrorMessage('service-not-allowed', 'refinement'), /speech-recognition service/)
  assert.match(getVoiceErrorMessage('network', 'idea'), /internet connection/)
  assert.match(getVoiceErrorMessage('no-speech', 'refinement'), /No speech was detected/)
  assert.match(getVoiceErrorMessage('unknown-error', 'refinement'), /refinement instructions/)
})
