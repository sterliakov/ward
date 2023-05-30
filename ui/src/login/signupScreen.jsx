import {makeSignDoc} from '@cosmjs/amino';
import {toBinary} from '@cosmjs/cosmwasm-stargate';
import {Bip39, Random} from '@cosmjs/crypto';
import {coins} from '@cosmjs/stargate';
import React from 'react';
import {ArrowClockwise} from 'react-bootstrap-icons';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';

import Ward, {
  EXECUTE_MSG_TYPE_URL,
  FACTORY_CONTRACT_ADDRESS,
  HOST_CHAIN,
  SLAVE_CHAINS,
} from '../internal/ward';

export class SignupStartScreen extends React.Component {
  render() {
    return (
      <div className="h-100 d-flex flex-column justify-content-between">
        <Row className="py-3">
          <Col>
            <div
              className="d-grid"
              style={{gridTemplateColumns: '100%', rowGap: '6px'}}
            >
              <Button
                variant="primary"
                type="button"
                onClick={this.props.openNewScreen}
              >
                New Account
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={this.props.openRestoreScreen}
              >
                Restore Account
              </Button>
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}

export class NewAccountScreen extends React.Component {
  state = {
    step: 'mnemonic',
    error: null,
    password: '',
    password2: '',
    mnemonic: '',
    inProgress: false,
    txHash: null,
    address: null,
    selectedChains: [],
  };

  genMnemonic() {
    const ent = Random.getBytes(32);
    const mnemonic = Bip39.encode(ent).toString();
    this.setState({mnemonic});
  }

  async submitFirstPage(ev) {
    ev.preventDefault();
    this.setState({error: null});
    const {password, password2} = this.state;
    let address = null;
    let error = null;
    if (password !== password2) {
      error = 'Passwords do not match!';
    }
    else {
      try {
        address = await Ward.validateMnemonic(
          this.state.mnemonic,
          {prefix: HOST_CHAIN.prefix},
        );
      }
      catch (ex) {
        error = ex.toString();
      }
    }

    if (error != null) this.setState({error});
    else this.setState({step: 'deploy', address});
  }

  async submitSecondPage(ev) {
    ev.preventDefault();
    if (!this.state.selectedChains.length) {
      this.setState({error: 'Please select at least one chain!'});
      return;
    }

    this.setState({inProgress: true, error: null});
    await Ward.createFromMnemonic(
      this.state.mnemonic,
      this.state.password,
      {prefix: HOST_CHAIN.prefix},
    );
    const ward = new Ward();

    const sendMessage = async (chainId, msg) => {
      const wrapped = {
        typeUrl: EXECUTE_MSG_TYPE_URL,
        value: {
          sender: this.state.address,
          contract: FACTORY_CONTRACT_ADDRESS,
          msg: toBinary(msg),
          funds: [],
        },
      };
      const fee = {amount: [], gas: '400000'};
      const signed = await ward.signSimpleAsSelf(
        chainId,
        wrapped,
        fee,
        null,
        this.state.password,
      );
      try {
        const result = await ward.broadcastRaw(chainId, signed);
        console.log(result);
        this.setState({inProgress: false});
        try {
          // If this succeeded, we're all set, transaction was sent.
          const logs = JSON.parse(result.rawLog);
          this.setState({txHash: result.transactionHash});
          return logs;
        }
        catch (ex) {
          this.setState({error: result?.rawLog ?? 'Broadcasting failed.'});
          throw ex;
        }
      }
      catch (ex) {
        this.setState({error: ex.toString()});
        throw ex;
      }
    };

    const hostLog = await sendMessage(
      HOST_CHAIN.chainId,
      {
        create_host: {
          recovery_pool: [],
          approval_pool: [],
          recovery_approvals_needed: 1,
          transfer_ownership_approvals_needed: 1,
        },
      },
    );
    const hostAddr = hostLog
      .map((ob) =>
        ob.events
          .map((e) => e.attributes.filter((a) => a.key === 'host_address'))
          .filter((a) => a.length),
      )
      .reduce((acc, el) => [...acc, ...el], [])[0][0].value;

    await Promise.all(
      Object.keys(SLAVE_CHAINS).map((chainId) =>
        sendMessage(
          chainId,
          {
            create_slave: {
              host_address: hostAddr,
              slave_chain: chainId,
            },
          },
        ),
      ),
    );
  }

  render() {
    return (
      <>
        {this.state.step === 'mnemonic' && (
          <div className="h-100 d-flex flex-column justify-content-between">
            <Row className="py-3">
              <Col>
                <div className="d-flex justify-content-between align-items-center">
                  <h1 className="fs-5" style={{textAlign: 'center'}}>
                    New Account
                  </h1>
                  <Button variant="secondary" onClick={this.props.back}>
                    Back
                  </Button>
                </div>
              </Col>
            </Row>
            <Row className="py-3">
              <Col>
                <Form onSubmit={this.submitFirstPage.bind(this)}>
                  <div
                    className="d-grid"
                    style={{gridTemplateColumns: '100%', rowGap: '6px'}}
                  >
                    <Button
                      variant="outline-dark"
                      className="pe-3"
                      type="button"
                      onClick={this.genMnemonic.bind(this)}
                    >
                      <span>Generate</span>
                      <ArrowClockwise />
                    </Button>
                    <FloatingLabel label="Mnemonic" controlId="create-mnemonic">
                      <Form.Control
                        as="textarea"
                        className="h-auto"
                        rows="4"
                        value={this.state.mnemonic}
                        onChange={(ev) =>
                          this.setState({mnemonic: ev.target.value})
                        }
                      />
                    </FloatingLabel>

                    <FloatingLabel
                      className="mb-3"
                      label="Password"
                      controlId="create-password"
                    >
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={this.state.password}
                        onChange={(ev) =>
                          this.setState({password: ev.target.value})
                        }
                      />
                    </FloatingLabel>
                    <FloatingLabel
                      className="mb-3"
                      label="Confirm password"
                      controlId="create-confirm-password"
                    >
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={this.state.password2}
                        onChange={(ev) =>
                          this.setState({password2: ev.target.value})
                        }
                      />
                    </FloatingLabel>

                    {this.state.error && (
                      <Alert variant="danger">{this.state.error}</Alert>
                    )}
                    <Button variant="primary" type="submit">
                      Continue
                    </Button>
                  </div>
                </Form>
              </Col>
            </Row>
          </div>
        )}
        {this.state.step === 'deploy' && this.props.target === 'new' && (
          <div className="h-100 d-flex flex-column justify-content-between">
            <Row className="py-3">
              <Col>
                <div className="d-flex justify-content-between align-items-center">
                  <h1 className="fs-5" style={{textAlign: 'center'}}>
                    Account Details
                  </h1>
                  <Button variant="secondary" onClick={this.props.back}>
                    Back
                  </Button>
                </div>
              </Col>
            </Row>
            <Row className="py-3">
              <Col>
                <Form onSubmit={this.submitSecondPage.bind(this)}>
                  <div
                    className="d-grid"
                    style={{gridTemplateColumns: '100%', rowGap: '6px'}}
                  >
                    <FloatingLabel
                      className="mb-3"
                      label="Address"
                      controlId="create-address"
                    >
                      <Form.Control
                        type="text"
                        value={this.state.address}
                        readonly
                      />
                    </FloatingLabel>

                    <Form.Text>
                      You will need some $INJ on your balance to cover
                      deployment fees.
                    </Form.Text>

                    <FloatingLabel
                      className="mb-3"
                      label="Select chains"
                      controlId="create-chains"
                    >
                      <Form.Control
                        as="select"
                        multiple
                        value={this.state.selectedChains}
                        onChange={(e) =>
                          this.setState({
                            selectedChains: [].slice
                              .call(e.target.selectedOptions)
                              .map((item) => item.value),
                          })
                        }
                      >
                        {Object.entries(SLAVE_CHAINS).map(
                          ([chainId, {name}]) => (
                            <option key={chainId} value={chainId}>
                              {name}
                            </option>
                          ),
                        )}
                      </Form.Control>
                    </FloatingLabel>

                    {this.state.error && (
                      <Alert variant="danger">{this.state.error}</Alert>
                    )}
                    {this.state.txHash ? (
                      <>
                        <Alert variant="success">
                          <Alert.Heading>Creation complete!</Alert.Heading>
                        </Alert>
                        <Button
                          variant="primary"
                          type="button"
                          onClick={this.props.done}
                        >
                          Home
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={this.state.inProgress}
                      >
                        {this.state.inProgress ? (
                          <Spinner animation="border" variant="light" />
                        ) : (
                          'Continue'
                        )}
                      </Button>
                    )}
                  </div>
                </Form>
              </Col>
            </Row>
          </div>
        )}
      </>
    );
  }
}

export default class SignupScreen extends React.Component {
  state = {
    step: 'start', // 'start' or 'next'
    target: null, // 'new' or 'restore'
  };

  render() {
    return (
      <>
        {this.state.step === 'start' && (
          <SignupStartScreen
            openNewScreen={() => this.setState({step: 'next', target: 'new'})}
            openRestoreScreen={() => {
              alert('Not implemented');
              // this.setState({step: 'next', target: 'restore'});
            }}
          />
        )}
        {this.state.step === 'next' && (
          <NewAccountScreen
            target={this.state.target}
            back={() => this.setState({step: 'start'})}
            done={this.props.back}
          />
        )}
      </>
    );
  }
}
