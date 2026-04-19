import React from 'react';

function createHostComponent(name: string) {
  return function HostComponent(props: Record<string, unknown>) {
    return React.createElement(name, props, props.children);
  };
}

export const Alert = {
  alert: () => {},
};

export const Platform = {
  OS: 'android',
  select<T>(config: { android?: T; ios?: T; default?: T }) {
    return config.android ?? config.default;
  },
};

export const Modal = ({ visible = true, children, ...props }: Record<string, unknown>) =>
  visible ? React.createElement('Modal', props, children) : null;

export const Pressable = createHostComponent('Pressable');
export const Text = createHostComponent('Text');
export const View = createHostComponent('View');

export const StyleSheet = {
  create<T>(styles: T) {
    return styles;
  },
};

export function useColorScheme() {
  return 'light';
}
