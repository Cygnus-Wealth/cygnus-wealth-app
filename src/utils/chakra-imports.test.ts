import { describe, it, expect } from 'vitest';
import * as ChakraUI from '@chakra-ui/react';

describe('Chakra UI v3 Imports', () => {
  it('should have createToaster instead of useToast', () => {
    // This test validates that we're using the correct Chakra UI v3 API
    expect(ChakraUI.createToaster).toBeDefined();
    expect((ChakraUI as Record<string, unknown>).useToast).toBeUndefined();
  });

  it('should have Dialog instead of Modal', () => {
    expect(ChakraUI.Dialog).toBeDefined();
    expect((ChakraUI as Record<string, unknown>).Modal).toBeUndefined();
  });

  it('should have compound Drawer components', () => {
    expect(ChakraUI.Drawer).toBeDefined();
    expect((ChakraUI as Record<string, unknown>).DrawerOverlay).toBeUndefined();
  });

  it('should have compound Switch components', () => {
    expect(ChakraUI.Switch).toBeDefined();
    // In v3, Switch should have Root, Control, and Thumb sub-components
    if (ChakraUI.Switch && typeof ChakraUI.Switch === 'object') {
      expect((ChakraUI.Switch as Record<string, unknown>).Root).toBeDefined();
      expect((ChakraUI.Switch as Record<string, unknown>).Control).toBeDefined();
      expect((ChakraUI.Switch as Record<string, unknown>).Thumb).toBeDefined();
    }
  });
});