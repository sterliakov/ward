import React from 'react';

import init from '../content/init';
import AccountScreen from './accountScreen';
import FirstStep from './firstStep';
import SignupScreen from './signupScreen';

export default class PopupForm extends React.Component {
  state = {
    step: 'start',
  };

  constructor(props) {
    super(props);
    init();
  }

  render() {
    return (
      <>
        {this.state.step === 'start' && (
          <FirstStep
            continueUnlocked={() => this.setState({step: 'balances'})}
            beginCreateNew={() => this.setState({step: 'signup'})}
          />
        )}
        {this.state.step === 'balances' && <AccountScreen />}
        {this.state.step === 'signup' && (
          <SignupScreen back={() => this.setState({step: 'start'})} />
        )}
      </>
    );
  }
}
