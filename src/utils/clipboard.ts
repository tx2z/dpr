/**
 * Copy text to clipboard using OSC 52 escape sequence.
 * Works in terminals that support it: iTerm2, kitty, alacritty, WezTerm,
 * GNOME Terminal (needs setting), and many others.
 * No external dependencies required.
 */
export function copyToClipboard(text: string): boolean {
  try {
    // OSC 52 escape sequence: \x1b]52;c;<base64-encoded-text>\x07
    // 'c' = clipboard (as opposed to 'p' for primary selection)
    const base64 = Buffer.from(text).toString('base64');
    const osc52 = `\x1b]52;c;${base64}\x07`;
    process.stdout.write(osc52);
    return true;
  } catch {
    return false;
  }
}
