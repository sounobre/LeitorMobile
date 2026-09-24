import React, { type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getSession } from '@/services/sync';
import RootLayout from '../../app/_layout';

jest.mock('react-native', () => ({
  TurboModuleRegistry: { get: () => undefined },
  NativeModules: {},
  useColorScheme: () => 'light',
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children?: ReactNode }) => children ?? null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));
jest.mock('react-native-paper', () => ({
  ActivityIndicator: () => null,
  PaperProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  MD3DarkTheme: { colors: {} },
  MD3LightTheme: { colors: {} },
}));
jest.mock('@epubjs-react-native/core', () => ({
  ReaderProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  useSQLiteContext: jest.fn(),
}));
jest.mock('expo-router', () => ({
  Stack: Object.assign(jest.fn(() => null), { Screen: () => null }),
  useRouter: jest.fn(),
  useSegments: jest.fn(),
}));
jest.mock('@/db/migrations', () => ({ migrateDatabase: jest.fn() }));
jest.mock('@/services/sync', () => ({ getSession: jest.fn() }));

const mockDb = {} as unknown as ReturnType<typeof useSQLiteContext>;
const mockReplace = jest.fn();
const routerObjects: unknown[] = [];
let activeSegments: string[] = ['index'];
let renderer: ReactTestRenderer | undefined;

describe('RootLayout AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeSegments = ['index'];
    routerObjects.length = 0;
    renderer = undefined;

    jest.mocked(useSQLiteContext).mockReturnValue(mockDb);
    jest.mocked(useRouter).mockImplementation(() => {
      const router = { replace: mockReplace };
      routerObjects.push(router);
      return router as unknown as ReturnType<typeof useRouter>;
    });
    jest.mocked(useSegments).mockImplementation(() => (
      activeSegments as unknown as ReturnType<typeof useSegments>
    ));
    jest.mocked(getSession)
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementation(() => new Promise(() => undefined));
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
  });

  it('does not restart the auth lookup when useRouter returns a new object', async () => {
    await act(async () => {
      renderer = create(React.createElement(RootLayout));
      await Promise.resolve();
    });

    expect({
      authCheckCalls: jest.mocked(getSession).mock.calls.length,
      routerIdentityChanged: routerObjects[0] !== routerObjects[1],
      stackRendered: (Stack as unknown as jest.Mock).mock.calls.length > 0,
      replacements: mockReplace.mock.calls,
    }).toEqual({
      authCheckCalls: 1,
      routerIdentityChanged: true,
      stackRendered: true,
      replacements: [['/login']],
    });
  });

  it('starts another auth lookup when the semantic route changes', async () => {
    await act(async () => {
      renderer = create(React.createElement(RootLayout));
      await Promise.resolve();
    });
    const checksBeforeRouteChange = jest.mocked(getSession).mock.calls.length;
    const stackRendersBeforeRouteChange = (Stack as unknown as jest.Mock).mock.calls.length;

    activeSegments = ['login'];
    await act(async () => {
      renderer?.update(React.createElement(RootLayout));
      await Promise.resolve();
    });

    expect(getSession).toHaveBeenCalledTimes(checksBeforeRouteChange + 1);
    expect((Stack as unknown as jest.Mock).mock.calls.length).toBeGreaterThan(stackRendersBeforeRouteChange);
  });
});
