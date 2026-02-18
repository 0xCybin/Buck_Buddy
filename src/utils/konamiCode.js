/**
 * konamiCode.js -- Easter egg detector for the classic Konami Code sequence.
 * Fires the provided callback once the full 10-key sequence is entered.
 * Returns a cleanup function to remove the keydown listener.
 */
export const setupKonamiCode = (callback) => {
  // Classic sequence: Up Up Down Down Left Right Left Right B A
  const code = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "KeyB",
    "KeyA",
  ];

  let position = 0; // tracks how far into the sequence the user is

  const handleKeyDown = (event) => {
    console.log("Key pressed:", event.code);

    if (event.code === code[position]) {
      console.log(`Correct key! Progress: ${position + 1}/${code.length}`);
      position++;
      if (position === code.length) {
        // Full sequence matched -- fire callback and reset
        console.log("Konami code entered!");
        callback();
        position = 0;
      }
    } else {
      // Any wrong key resets the sequence from the beginning
      console.log("Wrong key, resetting sequence");
      position = 0;
    }
  };

  console.log("Setting up Konami code listener");
  window.addEventListener("keydown", handleKeyDown);

  // Return cleanup function (useful for React useEffect teardown)
  return () => {
    console.log("Cleaning up Konami code listener");
    window.removeEventListener("keydown", handleKeyDown);
  };
};
