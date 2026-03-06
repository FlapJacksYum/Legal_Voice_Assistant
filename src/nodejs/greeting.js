/**
 * Mandatory AI disclosure greeting for Legal Intake Voice Service.
 * Played at call start in the attorney's voice; configurable via ATTORNEY_NAME.
 * Callers can interrupt via speech (VAD / STT); greeting is then stopped and conversation starts.
 */

const ATTORNEY_NAME_ENV = 'ATTORNEY_NAME';
const DEFAULT_ATTORNEY_LABEL = 'the attorney';

/**
 * Default greeting text with placeholders. [Attorney Name] and [Attorney] are replaced
 * by the same value (ATTORNEY_NAME env or default).
 */
const DEFAULT_GREETING_TEMPLATE = `Hello, you've reached the office of [Attorney Name]. I am [Attorney]'s AI intake assistant. I'm here to gather some initial information so [Attorney] can review your case.`;

/**
 * Get the mandatory AI disclosure greeting text.
 * Replaces [Attorney Name] and [Attorney] with the configured attorney label.
 * @param {object} options - { attorneyName?: string }
 * @returns {string}
 */
function getGreetingText(options = {}) {
  const attorney = options.attorneyName != null
    ? options.attorneyName
    : (process.env[ATTORNEY_NAME_ENV] || DEFAULT_ATTORNEY_LABEL);
  return DEFAULT_GREETING_TEMPLATE
    .replace(/\[Attorney Name\]/g, attorney)
    .replace(/\[Attorney\]/g, attorney);
}

module.exports = {
  getGreetingText,
  DEFAULT_GREETING_TEMPLATE,
  ATTORNEY_NAME_ENV,
  DEFAULT_ATTORNEY_LABEL,
};
