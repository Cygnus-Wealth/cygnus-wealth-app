import {
  Box,
  Button,
  Stack,
  Text,
  Input,
  IconButton,
  Grid,
  Flex,
  Dialog,
  createToaster,
} from '@chakra-ui/react';
import { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { useStore, type Token } from '../../store/useStore';
import { isAddress } from 'viem';

interface TokenManagerProps {
  accountId: string;
  platform: string;
}

// Common tokens by chain
const commonTokens: Record<string, Token[]> = {
  'Ethereum': [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 1 },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 1 },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, chainId: 1 },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18, chainId: 1 },
  ],
  'Polygon': [
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 137 },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 137 },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 137 },
    { address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, chainId: 137 },
  ],
  'Arbitrum': [
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 42161 },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 42161 },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 42161 },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, chainId: 42161 },
  ],
  'Optimism': [
    { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 10 },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 10 },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 10 },
    { address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, chainId: 10 },
  ],
};

const toaster = createToaster({
  placement: 'top'
});

export default function TokenManager({ accountId, platform }: TokenManagerProps) {
  const { accounts, updateAccount } = useStore();
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [customToken, setCustomToken] = useState({
    address: '',
    symbol: '',
    name: '',
    decimals: 18
  });

  const account = accounts.find(acc => acc.id === accountId);
  const tokens = account?.tokens || [];
  const availablePresets = commonTokens[platform] || [];
  const chainId = platform === 'Ethereum' ? 1 : 
                  platform === 'Polygon' ? 137 : 
                  platform === 'Arbitrum' ? 42161 : 
                  platform === 'Optimism' ? 10 : 1;

  const addToken = (token: Token) => {
    if (!account) return;

    // Check if token already exists
    if (tokens.some(t => t.address.toLowerCase() === token.address.toLowerCase())) {
      toaster.create({
        title: 'Token already added',
        description: `${token.symbol} is already being tracked`,
        type: 'error',
        duration: 3000
      });
      return;
    }

    const updatedTokens = [...tokens, token];
    updateAccount(accountId, { tokens: updatedTokens });

    toaster.create({
      title: 'Token added',
      description: `${token.symbol} has been added to tracking`,
      type: 'success',
      duration: 3000
    });
  };

  const removeToken = (tokenAddress: string) => {
    if (!account) return;

    const updatedTokens = tokens.filter(t => t.address !== tokenAddress);
    updateAccount(accountId, { tokens: updatedTokens });
  };

  const handleAddCustomToken = () => {
    if (!isAddress(customToken.address)) {
      toaster.create({
        title: 'Invalid address',
        description: 'Please enter a valid token contract address',
        type: 'error',
        duration: 3000
      });
      return;
    }

    const token: Token = {
      ...customToken,
      chainId,
      decimals: Number(customToken.decimals)
    };

    addToken(token);
    setCustomToken({ address: '', symbol: '', name: '', decimals: 18 });
    setIsAddingToken(false);
  };

  return (
    <Box>
      <Stack gap={4}>
        <Flex justify="space-between" align="center">
          <Text fontSize="lg" fontWeight="semibold">Tracked Tokens</Text>
          <Button
            size="sm"
            onClick={() => setIsAddingToken(true)}
            variant="outline"
          >
            <FiPlus />
            Add Token
          </Button>
        </Flex>

        {/* Current Tokens */}
        {tokens.length > 0 ? (
          <Stack gap={2}>
            {tokens.map((token) => (
              <Flex
                key={token.address}
                p={3}
                bg="gray.50"
                borderRadius="md"
                justify="space-between"
                align="center"
              >
                <Box>
                  <Text fontWeight="medium">{token.symbol}</Text>
                  <Text fontSize="sm" color="gray.600">{token.name}</Text>
                  <Text fontSize="xs" color="gray.500" fontFamily="mono">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </Text>
                </Box>
                <IconButton
                  aria-label="Remove token"
                  size="sm"
                  variant="ghost"
                  color="red.500"
                  onClick={() => removeToken(token.address)}
                >
                  <FiTrash2 />
                </IconButton>
              </Flex>
            ))}
          </Stack>
        ) : (
          <Text color="gray.500" textAlign="center" py={4}>
            No tokens added. Native {platform} balance is always tracked.
          </Text>
        )}

        {/* Common Tokens */}
        {availablePresets.length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>Popular Tokens</Text>
            <Grid templateColumns="repeat(auto-fill, minmax(100px, 1fr))" gap={2}>
              {availablePresets
                .filter(preset => !tokens.some(t => t.address.toLowerCase() === preset.address.toLowerCase()))
                .map((preset) => (
                  <Button
                    key={preset.address}
                    size="sm"
                    variant="outline"
                    onClick={() => addToken(preset)}
                  >
                    {preset.symbol}
                  </Button>
                ))}
            </Grid>
          </Box>
        )}
      </Stack>

      {/* Add Custom Token Dialog */}
      <Dialog.Root open={isAddingToken} onOpenChange={(e) => setIsAddingToken(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add Custom Token</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            
            <Dialog.Body>
              <Stack gap={4}>
                <Box>
                  <Text fontWeight="medium" mb={2}>Token Contract Address</Text>
                  <Input
                    placeholder="0x..."
                    value={customToken.address}
                    onChange={(e) => setCustomToken({ ...customToken, address: e.target.value })}
                    fontFamily="mono"
                  />
                </Box>

                <Box>
                  <Text fontWeight="medium" mb={2}>Symbol</Text>
                  <Input
                    placeholder="e.g., USDC"
                    value={customToken.symbol}
                    onChange={(e) => setCustomToken({ ...customToken, symbol: e.target.value })}
                  />
                </Box>

                <Box>
                  <Text fontWeight="medium" mb={2}>Name</Text>
                  <Input
                    placeholder="e.g., USD Coin"
                    value={customToken.name}
                    onChange={(e) => setCustomToken({ ...customToken, name: e.target.value })}
                  />
                </Box>

                <Box>
                  <Text fontWeight="medium" mb={2}>Decimals</Text>
                  <Input
                    type="number"
                    placeholder="18"
                    value={customToken.decimals}
                    onChange={(e) => setCustomToken({ ...customToken, decimals: parseInt(e.target.value) || 18 })}
                  />
                </Box>
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="outline" onClick={() => setIsAddingToken(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleAddCustomToken}
                disabled={!customToken.address || !customToken.symbol || !customToken.name}
              >
                Add Token
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}