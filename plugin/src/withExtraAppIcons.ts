import {
  ConfigPlugin,
  ExportedConfigWithProps,
  withDangerousMod,
  withAndroidManifest,
  withXcodeProject,
  AndroidConfig,
  IOSConfig,
  XcodeProject,
} from "@expo/config-plugins";
import { generateImageAsync } from "@expo/image-utils";
import fs from "fs";
import path from "path";
import sharp from "sharp";
// @ts-ignore

const { getMainApplicationOrThrow, getMainActivityOrThrow } =
  AndroidConfig.Manifest;

const androidFolderPath = ["app", "src", "main", "res"];
const androidFolderNames = [
  "mipmap-hdpi",
  "mipmap-mdpi",
  "mipmap-xhdpi",
  "mipmap-xxhdpi",
  "mipmap-xxxhdpi",
];
const androidSize = [162, 108, 216, 324, 432];

const iosLiquidGlassAppIcons = "AppIcons";

type Platform = "ios" | "android";

type Icon = {
  name: string;
  isMainIcon: boolean;
  androidForeground: string;
  androidBackground: string;
  androidMonochrome: string;
  iosIconFile: string;
  platforms: Platform[];
};

type PluginSettings = {
  expoExtraAppIconsPath: string;
  icons: Icon[];
};

const withExtraAppIcons: ConfigPlugin<PluginSettings> = (
  config,
  props = {
    expoExtraAppIconsPath: "assets/extra-app-icons",
    icons: [],
  },
) => {
  const { expoExtraAppIconsPath, icons } = props;

  const iosIcons = findIconsForPlatform(icons, "ios");

  if (iosIcons.length > 0) {
    config = withIosIcon(config, { expoExtraAppIconsPath, icons: iosIcons });
    config = withXcodeBuildSettings(config, {
      expoExtraAppIconsPath,
      icons: iosIcons,
    });
  }

  const androidIcons = findIconsForPlatform(icons, "android");

  if (androidIcons.length > 0) {
    config = withIconAndroidManifest(config, { expoExtraAppIconsPath, icons: androidIcons });
    config = withIconAndroidImages(config, { expoExtraAppIconsPath, icons: androidIcons });
  }
  return config;
};

const findIconsForPlatform = (icons: Icon[], platform: Platform) => {
  return icons.filter((icon) => icon.platforms.includes(platform));
};

// for android
const withIconAndroidManifest: ConfigPlugin<PluginSettings> = (config, props) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication: any = getMainApplicationOrThrow(config.modResults);
    const mainActivity = getMainActivityOrThrow(config.modResults);

    const iconNamePrefix = `${config.android!.package}.MainActivity`;

    const mainIcon = props.icons.find((icon) => icon.isMainIcon);
    if (!mainIcon) throw new Error("No main icon defined in icons array.");

    function addIconActivityAlias(config: any[]): any[] {
      return [
        ...config,
        ...props.icons.map((icon) => {
          const isMain = icon.isMainIcon === true;
          return {
            $: {
              "android:name": `${iconNamePrefix}${icon.name}`,
              "android:enabled": isMain ? "true" : "false",
              "android:exported": "true",
              "android:icon": `@mipmap/${icon.name}`,
              "android:targetActivity": ".MainActivity",
            },
            "intent-filter": [
              ...(mainActivity["intent-filter"] || [
                {
                  action: [
                    { $: { "android:name": "android.intent.action.MAIN" } },
                  ],
                  category: [
                    { $: { "android:name": "android.intent.category.LAUNCHER" } },
                  ],
                },
              ]),
            ],
          };
        }),
      ];
    }

    function removeIconActivityAlias(config: any[]): any[] {
      return config.filter(
        (activityAlias) =>
          !(activityAlias.$["android:name"] as string).startsWith(iconNamePrefix),
      );
    }

    delete mainActivity["intent-filter"];
    mainActivity.$["android:enabled"] = "true";
    mainActivity.$["android:exported"] = "true";

    mainApplication["activity-alias"] = removeIconActivityAlias(
      mainApplication["activity-alias"] || [],
    );
    mainApplication["activity-alias"] = addIconActivityAlias(
      mainApplication["activity-alias"] || [],
    );

    const iconData = props.icons.map(icon => ({
      name: icon.name,
      isMainIcon: !!icon.isMainIcon,
    }));

    if (!mainApplication["meta-data"]) mainApplication["meta-data"] = [];

    mainApplication["meta-data"] = mainApplication["meta-data"].filter(
      (entry: { $: { [x: string]: string; }; }) => entry.$["android:name"] !== "expo.extra_app_icons"
    );

    mainApplication["meta-data"].push({
      $: {
        "android:name": "expo.extra_app_icons",
        "android:value": JSON.stringify(iconData),
      },
    });

    return config;
  });
};


const withIconAndroidImages: ConfigPlugin<PluginSettings> = (config, props) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidResPath = path.join(
        config.modRequest.platformProjectRoot,
        ...androidFolderPath,
      );

      const removeIconRes = async () => {
        for (const folderName of androidFolderNames) {
          const folder = path.join(androidResPath, folderName);
          const files = await fs.promises.readdir(folder).catch(() => []);
          for (const file of files) {
            if (!file.startsWith("ic_launcher")) {
              await fs.promises.rm(path.join(folder, file), { force: true }).catch(() => null);
            }
          }
        }
      };

      const addIconRes = async () => {
        for (let i = 0; i < androidFolderNames.length; i++) {
          const size = androidSize[i];
          const outputPath = path.join(androidResPath, androidFolderNames[i]);

          for (const icon of props.icons) {
            const { name, androidForeground, androidBackground, androidMonochrome } = icon;

            const baseName = `${name}-${size}`;

            const loadImage = async (src: string) => {
              const { source } = await generateImageAsync(
                {
                  projectRoot: config.modRequest.projectRoot,
                  cacheType: "react-native-dynamic-app-icon",
                },
                {
                  name: baseName,
                  src: path.join(props.expoExtraAppIconsPath, src),
                  resizeMode: "contain",
                  width: size,
                  height: size,
                },
              );
              return Buffer.from(source);
            };

            // combine background + foreground
            if (androidBackground) {
              const bg = await loadImage(androidBackground);
              const fg = await loadImage(androidForeground);

              const composed = await sharp(bg)
                .composite([{ input: fg }])
                .png()
                .toBuffer();

              await fs.promises.writeFile(path.join(outputPath, `${name}.png`), composed);
            } else {
              const fg = await loadImage(androidForeground);
              await fs.promises.writeFile(path.join(outputPath, `${name}.png`), fg);
            }

            // keep separate layers for adaptive icons
            if (androidForeground)
              await fs.promises.writeFile(
                path.join(outputPath, `${name}_foreground.png`),
                await loadImage(androidForeground),
              );

            if (androidMonochrome)
              await fs.promises.writeFile(
                path.join(outputPath, `${name}_monochrome.png`),
                await loadImage(androidMonochrome),
              );

            if (androidBackground)
              await fs.promises.writeFile(
                path.join(outputPath, `${name}_background.png`),
                await loadImage(androidBackground),
              );
          }
        }
      };

      const renameIconRes = async () => {
        for (let i = 0; i < androidFolderNames.length; i++) {
          const size = androidSize[i];
          const outputPath = path.join(androidResPath, androidFolderNames[i]);

          for (const { name } of props.icons) {
            const base = `${name}-${size}`;
            const renameSafe = async (from: string, to: string) => {
              await fs.promises.rename(from, to).catch(() => null);
            };

            await renameSafe(`${outputPath}/${base}.png`, `${outputPath}/${name}.png`);
            await renameSafe(`${outputPath}/${base}_foreground.png`, `${outputPath}/${name}_foreground.png`);
            await renameSafe(`${outputPath}/${base}_monochrome.png`, `${outputPath}/${name}_monochrome.png`);
            await renameSafe(`${outputPath}/${base}_background.png`, `${outputPath}/${name}_background.png`);
          }
        }
      };

      const addIconXml = async () => {
        for (const { name } of props.icons) {
          const outputPath = path.join(androidResPath, "mipmap-anydpi-v26");
          const content = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/${name}_background"/>
  <foreground android:drawable="@mipmap/${name}_foreground"/>
  <monochrome android:drawable="@mipmap/${name}_monochrome"/>
</adaptive-icon>`;

          await fs.promises.writeFile(`${outputPath}/${name}.xml`, content.trim());
        }
      };

      await removeIconRes();
      await addIconRes();
      await renameIconRes();
      await addIconXml();

      return config;
    },
  ]);
};


// for ios

const withIosIcon: ConfigPlugin<PluginSettings> = (config, props) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      await cleanDirAndEnsureDirExists(config);
      await iterateIconsAsync(config, props);
      return config;
    },
  ]);
};

async function cleanDirAndEnsureDirExists(config: ExportedConfigWithProps) {
  const iosRoot = path.join(
    config.modRequest.platformProjectRoot,
    config.modRequest.projectName!,
  );

  // Delete all existing assets
  await fs.promises
    .rm(path.join(iosRoot, iosLiquidGlassAppIcons), {
      recursive: true,
      force: true,
    })
    .catch(() => null);

  // Ensure directory exists
  await fs.promises.mkdir(path.join(iosRoot, iosLiquidGlassAppIcons), {
    recursive: true,
  });
}

async function iterateIconsAsync(
  config: ExportedConfigWithProps,
  props: PluginSettings,
) {
  const { expoExtraAppIconsPath, icons } = props;
  const iosRoot = path.join(
    config.modRequest.platformProjectRoot,
    config.modRequest.projectName!,
  );

  icons.forEach((icon) => {
    if (icon.iosIconFile) {
      const locationPath = path.join(
        config.modRequest.projectRoot,
        expoExtraAppIconsPath,
        icon.iosIconFile,
      );

      const destinationPath = path.join(
        iosRoot,
        iosLiquidGlassAppIcons,
        icon.name + ".icon",
      );

      fs.promises.cp(locationPath, destinationPath, { recursive: true });
    }
  });
}

const getAppTargetUuid = (xcodeProject: XcodeProject, projectName: string) => {
  const nativeTargets = xcodeProject.pbxNativeTargetSection() as {
    name: string;
    [key: string]: any;
  };
  for (const [uuid, target] of Object.entries(nativeTargets)) {
    if (target.name === `"${projectName}"` || target.name === projectName) {
      return uuid;
    }
  }
  throw new Error(`No native target found for project "${projectName}"`);
};

const withXcodeBuildSettings: ConfigPlugin<PluginSettings> = (
  config,
  { icons },
) => {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const iconNames = icons.map((icon) => icon.name);

    const mainIcon = icons.filter((icon) => icon.isMainIcon === true)[0];

    if (!mainIcon) throw new Error("No main icon defined");

    icons.forEach((icon) => {
      IOSConfig.XcodeUtils.addFileToGroupAndLink({
        filepath: path.join(
          config.modRequest.platformProjectRoot,
          config.modRequest.projectName!,
          iosLiquidGlassAppIcons,
          icon.name + ".icon",
        ),
        groupName: config.modRequest.projectName!,
        project: xcodeProject,
        targetUuid: getAppTargetUuid(
          xcodeProject,
          config.modRequest.projectName!,
        ),
        addFileToProject({ project, file }) {
          project.addToPbxFileReferenceSection(file);
          project.addToPbxBuildFileSection(file);
          project.addToPbxResourcesBuildPhase(file);
        },
      });
    });

    xcodeProject.addBuildProperty(
      '"ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES[sdk=*]"',
      `"${iconNames.join(" ")}"`,
    );
    xcodeProject.addBuildProperty(
      "ASSETCATALOG_COMPILER_APPICON_NAME",
      `${mainIcon.name}`,
    );

    return config;
  });
};

export default withExtraAppIcons;
