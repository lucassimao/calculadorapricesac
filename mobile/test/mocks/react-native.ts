import React from 'react';

function createHostComponent(name: string) {
  return function HostComponent(props: React.PropsWithChildren<Record<string, unknown>>) {
    return React.createElement(name, props, props.children);
  };
}

export const Alert = {
  alert: () => {},
};

export const ActionSheetIOS = {
  showActionSheetWithOptions: (_options: unknown, _callback: (buttonIndex: number) => void) => {},
};

export const Linking = {
  openURL: async () => {},
};

export const Platform = {
  OS: 'android',
  select<T>(config: { android?: T; ios?: T; default?: T }) {
    return config.android ?? config.default;
  },
};

export const Modal = ({
  visible = true,
  children,
  ...props
}: React.PropsWithChildren<{ visible?: boolean } & Record<string, unknown>>) =>
  visible ? React.createElement('Modal', props, children) : null;

export const Pressable = createHostComponent('Pressable');
export const ActivityIndicator = createHostComponent('ActivityIndicator');
export const Image = createHostComponent('Image');
export const ScrollView = createHostComponent('ScrollView');
export const Text = createHostComponent('Text');
export const TextInput = createHostComponent('TextInput');
export const View = createHostComponent('View');

export const StyleSheet = {
  absoluteFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  create<T>(styles: T) {
    return styles;
  },
};

export function useColorScheme() {
  return 'light';
}
