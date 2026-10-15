export function getSpeechRecognitionConstructor(browserWindow) {
  const constructor = browserWindow?.SpeechRecognition || browserWindow?.webkitSpeechRecognition
  return typeof constructor === 'function' ? constructor : null
}

export function appendVoiceTranscript(currentText, transcript, maxLength) {
  const existingText = typeof currentText === 'string' ? currentText : ''
  const spokenText = typeof transcript === 'string' ? transcript.trim() : ''
  const separator = existingText && spokenText && !/\s$/.test(existingText) ? ' ' : ''
  const value = `${existingText}${separator}${spokenText}`
  return { value, exceedsLimit: value.length > maxLength }
}

export function getVoiceErrorMessage(error, target) {
  const responseName = target === 'idea' ? 'idea' : 'refinement instructions'
  const messages = {
    'not-allowed': 'Microphone access was denied or blocked. Allow microphone permission for this site in your browser settings, and use localhost or HTTPS before trying again.',
    'service-not-allowed': 'The browser or device has disabled its speech-recognition service. Check browser or device speech settings, or type your response.',
    'audio-capture': 'No microphone is available. Connect or enable a microphone, then try again.',
    'no-speech': 'No speech was detected. Check that your microphone is working, then speak clearly and try again.',
    network: 'The browser could not reach its speech-recognition service. Check your internet connection, VPN or firewall settings, and browser speech-service availability. You can still type your response.',
    'language-not-supported': 'Speech recognition does not support the selected browser language. Change your browser language and try again.',
    aborted: 'Voice recognition was interrupted. Your existing text was kept; try again or continue typing.',
  }
  return messages[error] || `Voice recognition failed. Please try again or type your ${responseName}.`
}
