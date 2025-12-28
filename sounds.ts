// A utility function to play sounds. It creates a new Audio object for each playback
// to allow for overlapping sounds.
export function playSound(soundUrl: string, volume: number = 1.0) {
  try {
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    audio.play().catch(error => {
      // Autoplay was prevented. This is common and okay.
    });
  } catch (error) {
    console.warn("Could not play sound", error);
  }
}

// Sound effects as base64 data URIs

// A soft 'pop' for selecting a plane
export const selectSound = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAA';

// A positive 'ding' for a successful landing
export const landSound = 'data:audio/wav;base64,UklGRlIDAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YUkDAADv/u/9//5B/33/kv9Y/6D/Qf+h/zo/qP83/6n/Mv+r/y//sv8v/7T/MP+3/zL/uv80/7z/Nv+/wD3DwsfLzM/T1djZ29/h4+Xm5+np6+7v8PLy8/X19vf4+fr7/P3+/wABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1VWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T1d';

// A harsher 'crash' sound for collisions or planes flying off-screen
export const crashSound = 'data:audio/wav;base64,UklGRkIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YR4CAADw/wAA/v8AAAAAAAD//wD//wD//wAAAP///8n/kf+R/8n//v8AAP///wAAAP8A/wD/AP8A/wAAAP///wAAAP///wAA/v8AAP//AAAA//8AAAAA/wD/AP//AAAA///wAAD+/wAA/v8AAAAA/wAAAP//AAAA//8AAAAA/wAAAP//AAD+/wAAAP//AAAA//8AAP//AAAA//8AAAAA//8AAP//AAAA///wAAD//wAA/v8AAP//AAD//wAA//8AAAAA//8AAAAA/wAAAP//AAAA///wAAD//wAA/v8AAP//AAD//wAA//8AAAAA//8AAAAA/wAAAP//AAAA///wAAD//wAA/v8AAP//AAD//wAA//8AAAAA//8AAAAA/wAAAP//AAAA///wAAD//wAA/v8AAP//AAAA//8AAAAAAAAAAA==';