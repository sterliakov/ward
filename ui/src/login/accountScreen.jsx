import {makeSignDoc} from '@cosmjs/amino';
import {coins} from '@cosmjs/stargate';
import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';

import Ward from '../internal/ward';

export class BalanceRow extends React.Component {
  render() {
    const {denom, amount} = this.props;
    return (
      <Button
        onClick={() => this.props.openTransferScreen(denom)}
        className="fs-4"
        disabled={amount <= 0}
        variant={amount > 0 ? 'success' : 'secondary'}
      >
        {amount}
        <span className="ps-2 text-uppercase">{denom}</span>
      </Button>
    );
  }
}

export class TransferScreen extends React.Component {
  state = {
    error: null,
    password: '',
    to: '',
    amount: 0,
    denom: Ward.getFullDenom(this.props.denom, this.props.chainId),
    denomSelected: this.props.denom,
    inProgress: false,
    txHash: null,
  };

  async handleSubmit(ev) {
    ev.preventDefault();
    this.setState({inProgress: true, error: null});
    const ward = new Ward();
    const {chainId} = this.props;
    try {
      await ward.getAccountWithPrivkey(this.state.password);
    }
    catch (ex) {
      this.setState({error: 'Incorrect password.', inProgress: false});
      return;
    }

    const sendMsg = {
      bank: {
        send: {
          from_address: await ward.getFromAddress(chainId),
          to_address: this.state.to,
          amount: coins(this.state.amount, this.state.denomSelected),
        },
      },
    };
    const fee = {amount: [], gas: '250000'};
    const signed = await ward.signSimple(
      chainId,
      sendMsg,
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
        JSON.parse(result.rawLog);
        this.setState({txHash: result.transactionHash});
      }
      catch (ex) {
        this.setState({error: result.rawLog});
      }
    }
    catch (ex) {
      this.setState({error: ex});
    }
  }

  render() {
    return (
      <div className="h-100 d-flex flex-column justify-content-between">
        <Row className="py-3">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <h1 className="fs-5" style={{textAlign: 'center'}}>
                Transfer {this.state.denom.coinDenom}
              </h1>
              <Button variant="secondary" onClick={this.props.back}>
                Back
              </Button>
            </div>
          </Col>
        </Row>
        <Row className="py-3">
          <Col>
            <Form onSubmit={this.handleSubmit.bind(this)}>
              <div
                className="d-grid"
                style={{gridTemplateColumns: '100%', rowGap: '6px'}}
              >
                <FloatingLabel
                  className="mb-3"
                  label="Destination"
                  controlId="transfer-destination"
                >
                  <Form.Control
                    autoFocus
                    type="text"
                    placeholder="wasm1..." // TODO: dynamic prefix
                    value={this.state.to}
                    onChange={(ev) => this.setState({to: ev.target.value})}
                  />
                </FloatingLabel>

                <Row>
                  <Col>
                    <FloatingLabel
                      className="mb-3"
                      label="Amount"
                      controlId="transfer-amount"
                    >
                      <Form.Control
                        autoFocus
                        type="number"
                        min={0}
                        step={1}
                        value={this.state.amount}
                        onChange={(ev) =>
                          this.setState({amount: ev.target.value})
                        }
                      />
                    </FloatingLabel>
                  </Col>
                  <Col>
                    <FloatingLabel
                      className="mb-3"
                      label="Denom"
                      controlId="transfer-denom"
                    >
                      <Form.Select
                        onChange={(ev) => {
                          this.setState({denomSelected: ev.target.value});
                        }}
                        value={this.state.denomSelected}
                        disabled
                      >
                        {/* Exists to support fractional denoms in future */}
                        <option value={this.state.denom.coinDenom}>
                          {this.state.denom.coinDenom}
                        </option>
                      </Form.Select>
                    </FloatingLabel>
                  </Col>
                </Row>

                <FloatingLabel
                  className="mb-3"
                  label="Password"
                  controlId="transfer-password"
                >
                  <Form.Control
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={this.state.password}
                    onChange={(ev) =>
                      this.setState({password: ev.target.value})
                    }
                  />
                </FloatingLabel>
                {this.state.error && (
                  <Alert variant="danger">{this.state.error}</Alert>
                )}
                {this.state.txHash && (
                  <Alert variant="success">
                    <Alert.Heading>Transaction sent!</Alert.Heading>
                    <span style={{fontSize: '0.55rem'}}>
                      {this.state.txHash}
                    </span>
                  </Alert>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={this.state.inProgress}
                >
                  {this.state.inProgress ? (
                    <Spinner animation="border" variant="light" />
                  ) : (
                    'Sign and Broadcast'
                  )}
                </Button>
              </div>
            </Form>
          </Col>
        </Row>
      </div>
    );
  }
}

export class AccountState extends React.Component {
  state = {
    balances: [],
    error: null,
    // TODO: implement "hide zero balances" feature
  };

  componentDidMount() {
    this._asyncRequest = new Ward().getAllBalances().then((balances) => {
      this._asyncRequest = null;
      if (balances) this.setState({balances});
      else this.setState({balances: [], error: 'Failed to fetch balances.'});
    });
  }
  componentWillUnmount() {
    if (this._asyncRequest) this._asyncRequest.cancel();
  }

  render() {
    return (
      <div>
        {this.state.error && <Alert variant="danger">{this.state.error}</Alert>}
        <h6 className="py-3">Available Balances:</h6>
        <Tab.Container id="balance-tabs" defaultActiveKey={0}>
          <Row>
            <Col xs={3}>
              <Nav variant="pills" className="flex-column">
                {this.state.balances.map((chain, i) => (
                  <Nav.Item key={i}>
                    <Nav.Link eventKey={i}>{chain.name}</Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>
            </Col>
            <Col xs={9}>
              <Tab.Content>
                {this.state.balances.map((chain, i) => (
                  <Tab.Pane key={i} eventKey={i}>
                    {chain.balances.map(({denom, amount}) => (
                      <BalanceRow
                        key={i}
                        denom={denom}
                        amount={amount}
                        openTransferScreen={(denom) =>
                          this.props.openTransferScreen(denom, chain.chainId)
                        }
                      />
                    ))}
                  </Tab.Pane>
                ))}
              </Tab.Content>
            </Col>
          </Row>
        </Tab.Container>
      </div>
    );
  }
}

export default class AccountScreen extends React.Component {
  state = {
    step: 'balances',
    denom: null,
    chainId: null,
  };

  render() {
    return (
      <>
        {this.state.step === 'balances' && (
          <AccountState
            openTransferScreen={(denom, chainId) =>
              this.setState({denom, chainId, step: 'transfer'})
            }
          />
        )}
        {this.state.step === 'transfer' && (
          <TransferScreen
            back={() => this.setState({step: 'balances'})}
            denom={this.state.denom}
            chainId={this.state.chainId}
          />
        )}
      </>
    );
  }
}
