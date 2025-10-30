# expo-extra-app-icons

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2052+-blue)](https://docs.expo.dev/versions/latest/)
[![npm](https://img.shields.io/npm/v/@temmiland/expo-extra-app-icons)](https://www.npmjs.com/package/@temmiland/expo-extra-app-icons)
[![License](https://img.shields.io/npm/l/@temmiland/expo-extra-app-icons)](https://github.com/temmiland/expo-extra-app-icons/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/temmiland/expo-extra-app-icons?style=social)](https://github.com/temmiland/expo-extra-app-icons/stargazers)

Manage alternate app icons programmatically in **Expo** and **React Native**. Switch icons dynamically for iOS and Android without ejecting your project.

## Features

- Programmatically change your app icon
- Supports **iOS** and **Android**
- Easy setup with Expo plugins

## Installation

```bash
bunx expo install @temmiland/expo-extra-app-icons
````

## Setup

### 1. Add icon files

Place all your alternate icon files in a folder (e.g., `assets/images/app-icons`).

### 2. Configure the plugin

Add the plugin to your `app.json` under the `plugins` array:

```jsonc
"plugins": [
  [
    "@temmiland/expo-extra-app-icons",
    {
      "expoExtraAppIconsPath": "assets/images/app-icons",
      "icons": [
        {
          "name": "icon",
          "androidForeground": "icon-android-foreground@1.png",
          "androidBackground": "icon-android-background@1.png",
          "androidMonochrome": "icon-android-monochrome@1.png",
          "iosIconFile": "icon.icon",
          "isMainIcon": true,
          "platforms": ["ios", "android"]
        },
        {
          "name": "pride",
          "androidForeground": "pride-android-foreground@1.png",
          "androidBackground": "pride-android-background@1.png",
          "androidMonochrome": "pride-android-monochrome@1.png",
          "iosIconFile": "pride.icon",
          "platforms": ["ios", "android"]
        }
      ]
    }
  ]
]
```

> 💡 **Tip:** The plugin fully manages your app icon, so make sure you set one with (`isMainIcon: true`).

### 3. Prebuild the project

```bash
bunx expo prebuild --clean
```

### 4. Run your dev client

```bash
bunx expo run:ios
bunx expo run:android
```

## Usage

```ts
import { setAppIcon, getAppIcon } from '@temmiland/expo-extra-app-icons';

const [currentIcon, setCurrentIcon] = useState(getAppIcon());

setAppIcon(props.iconName);
setCurrentIcon(props.iconName);
```

## Support

If you like this project and want to support it:

- ⭐ Star it on GitHub
- 🔄 Share it with friends or colleagues
- 🐞 Report issues or suggest features
- 💡 Contribute code or improvements

[![Buy Me A Coffee](https://raw.githubusercontent.com/temmiland/temmiland/refs/heads/main/assets/bmc-button.png)](https://www.buymeacoffee.com/temmiland)
