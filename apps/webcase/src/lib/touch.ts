// A touch screen, where focusing a text field raises the on-screen keyboard.
// Nothing focuses a text field there by itself: the keyboard comes up only
// when the field is tapped. With a mouse and keyboard, focus goes to the
// field as usual. Browser only.
export const isTouchScreen = () => matchMedia('(pointer: coarse)').matches
