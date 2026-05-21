# SpeechMike

Direct Philips SpeechMike HID integration.

The extension runs a small macOS IOKit HID helper as a backend service. SpeechControl should put the device into **Event mode** and save the profile to the device. The helper reads the vendor event interface (`vendorId=0x0911`, `productId=0x0c1c`, usage page `0xffa0`) and maps semantic button events to Neon Pilot commands.

Default mapping for SpeechMike Premium 3500 / SpeechMike III event reports:

| Event                        | Command                 |
| ---------------------------- | ----------------------- |
| Record press                 | `dictation.toggle`      |
| Record release               | `dictation.toggle`      |
| Rewind                       | `conversation.previous` |
| Forward                      | `conversation.next`     |
| Play                         | `composer.submit`       |
| EOL                          | `composer.submit`       |
| Insert/Overwrite             | `composer.focus`        |
| F1                           | `palette.open`          |
| F2                           | `composer.focus`        |
| F3                           | `conversation.previous` |
| F4                           | `conversation.next`     |
| Device picked up / laid down | logged only             |

This is intentionally a first pass: decode real reports, execute useful defaults, and expose status/logs for calibration before adding user-editable per-button mappings.

Mouse ball, left click, and right click are intentionally left to macOS as normal mouse input; the extension only consumes SpeechControl Event mode reports.
