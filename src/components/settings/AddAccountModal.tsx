import {
  Dialog,
  Input,
  Button,
  Stack,
  Box,
  Text,
  createToaster,
} from '@chakra-ui/react';
import { useState } from 'react';
import { Formik, Form, Field, type FieldProps } from 'formik';
import * as yup from 'yup';
import { useStore } from '../../store/useStore';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const validationSchema = yup.object({
  label: yup.string().required('Account name is required'),
  address: yup
    .string()
    .required('Wallet address is required')
    .matches(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address'),
  platform: yup.string().required('Platform is required'),
});

const toaster = createToaster({
  placement: 'top'
});

export default function AddAccountModal({ isOpen, onClose }: AddAccountModalProps) {
  const { addAccount, accounts } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: { label: string; address: string; platform: string }) => {
    setIsSubmitting(true);
    
    try {
      // Check if address already exists
      const addressExists = accounts.some(
        acc => acc.address?.toLowerCase() === values.address.toLowerCase()
      );
      
      if (addressExists) {
        toaster.create({
          title: 'Address already added',
          description: 'This wallet address is already being tracked',
          type: 'error',
          duration: 3000
        });
        return;
      }

      const newAccount = {
        id: `account-${Date.now()}`,
        type: 'wallet' as const,
        platform: values.platform,
        label: values.label,
        address: values.address,
        status: 'connected' as const, // Auto-connect on add
        lastSync: new Date().toISOString(),
      };
      
      addAccount(newAccount);
      
      toaster.create({
        title: 'Account added',
        description: 'Your wallet has been added successfully',
        type: 'success',
        duration: 3000
      });
      
      onClose();
    } catch {
      toaster.create({
        title: 'Error',
        description: 'Failed to add account',
        type: 'error',
        duration: 3000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Add Wallet Account</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>
          
          <Dialog.Body>
            <Formik
              initialValues={{
                label: '',
                address: '',
                platform: 'Ethereum',
              }}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ errors, touched, isValid }) => (
                <Form>
                  <Stack gap={4}>
                    <Field name="label">
                      {({ field }: FieldProps) => (
                        <Stack gap={2}>
                          <Text fontWeight="medium">Account Name</Text>
                          <Input
                            {...field}
                            placeholder="e.g., Main Wallet"
                            disabled={isSubmitting}
                          />
                          {errors.label && touched.label && (
                            <Text color="red.500" fontSize="sm">
                              {errors.label}
                            </Text>
                          )}
                        </Stack>
                      )}
                    </Field>

                    <Field name="platform">
                      {({ field }: FieldProps) => (
                        <Stack gap={2}>
                          <Text fontWeight="medium">Network</Text>
                          <Box
                            as="select"
                            {...field}
                            aria-disabled={isSubmitting || undefined}
                            px={3}
                            py={2}
                            borderRadius="md"
                            border="1px solid"
                            borderColor="gray.200"
                            bg="white"
                            fontSize="md"
                            _focus={{
                              borderColor: "blue.500",
                              outline: "none",
                              boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)"
                            }}
                          >
                            <option value="Ethereum">Ethereum</option>
                            <option value="Polygon">Polygon</option>
                            <option value="Arbitrum">Arbitrum</option>
                            <option value="Optimism">Optimism</option>
                          </Box>
                        </Stack>
                      )}
                    </Field>

                    <Field name="address">
                      {({ field }: FieldProps) => (
                        <Stack gap={2}>
                          <Text fontWeight="medium">Wallet Address</Text>
                          <Input
                            {...field}
                            placeholder="0x..."
                            fontFamily="mono"
                            disabled={isSubmitting}
                          />
                          {errors.address && touched.address && (
                            <Text color="red.500" fontSize="sm">
                              {errors.address}
                            </Text>
                          )}
                        </Stack>
                      )}
                    </Field>
                  </Stack>

                  <Dialog.Footer>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      loading={isSubmitting}
                      disabled={!isValid || isSubmitting}
                    >
                      Add Account
                    </Button>
                  </Dialog.Footer>
                </Form>
              )}
            </Formik>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}