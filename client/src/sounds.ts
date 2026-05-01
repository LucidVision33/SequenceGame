const FILES = ['your-turn.mp3', 'sequence.mp3', 'win.mp3', 'place-token.mp3'];
let unlocked = false;

document.addEventListener('click', () => {
  if (unlocked) return;
  unlocked = true;
  FILES.forEach(file => {
    const a = new Audio(`/sounds/${file}`);
    a.volume = 0;
    a.play().then(() => a.pause()).catch(() => {});
  });
}, { once: true });

function play(file: string, volume = 1) {
  const a = new Audio(`/sounds/${file}`);
  a.volume = volume;
  a.play().catch(() => {});
}

export const sounds = {
  yourTurn:   () => play('your-turn.mp3'),
  sequence:   () => play('sequence.mp3'),
  win:        () => play('win.mp3'),
  placeToken: () => play('place-token.mp3', 0.5),
};
