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
 * Default closing text played after the AI signals call conclusion ([conclude_call]).
 * Informs the caller about attorney review and next steps.
 */
const DEFAULT_CLOSING_TEMPLATE = `The attorney will review what we've discussed and someone from the office will call you back. Thank you for calling.`;

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

/**
 * Get the call conclusion / closing text (attorney review and next steps).
 * Used when the AI has signaled [conclude_call] after gathering sufficient intake.
 * @param {object} options - { attorneyName?: string } (reserved for future placeholder)
 * @returns {string}
 */
function getClosingText(options = {}) {
  const attorney = options.attorneyName != null
    ? options.attorneyName
    : (process.env[ATTORNEY_NAME_ENV] || DEFAULT_ATTORNEY_LABEL);
  return DEFAULT_CLOSING_TEMPLATE
    .replace(/\[Attorney Name\]/g, attorney)
    .replace(/\[Attorney\]/g, attorney);
}

module.exports = {
  getGreetingText,
  getClosingText,
  DEFAULT_GREETING_TEMPLATE,
  DEFAULT_CLOSING_TEMPLATE,
  ATTORNEY_NAME_ENV,
  DEFAULT_ATTORNEY_LABEL,
};
