import React from 'react';

import init from '../content/init';
import {DEBUG} from '../internal/ward';
import AccountScreen from './accountScreen';
import FirstStep from './firstStep';

export default class PopupForm extends React.Component {
  state = {
    step: 'start',
  };

  componentDidMount() {
    if (!DEBUG) init();
  }

  render() {
    return (
      <>
        {this.state.step === 'start' && (
          <FirstStep
            continueUnlocked={() => this.setState({step: 'balances'})}
            beginCreateNew={() => alert('Not implemented')}
          />
        )}
        {this.state.step === 'balances' && <AccountScreen />}
      </>
    );
  }
}
