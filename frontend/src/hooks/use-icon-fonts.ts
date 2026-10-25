// Vector icon assets ship inside the Expo application. Keeping this hook
// synchronous prevents a remote font request from delaying the first screen.
export const useIconFonts = (): readonly [boolean, Error | null] => [true, null];
