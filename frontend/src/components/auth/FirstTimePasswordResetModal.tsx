import React from 'react';
import { FirstLoginPasswordModal, FirstLoginPasswordModalProps } from './FirstLoginPasswordModal';

export const FirstTimePasswordResetModal: React.FC<FirstLoginPasswordModalProps> = (props) => {
  return <FirstLoginPasswordModal {...props} />;
};

export { FirstLoginPasswordModal };
export type { FirstLoginPasswordModalProps };
export default FirstLoginPasswordModal;
