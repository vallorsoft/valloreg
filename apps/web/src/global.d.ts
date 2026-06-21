import type messages from './messages/hu.json';

/**
 * Augment next-intl with our message shape for type-safe `t()` keys.
 * The Hungarian dictionary is the source of truth for the key structure.
 */
type Messages = typeof messages;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}

export {};
