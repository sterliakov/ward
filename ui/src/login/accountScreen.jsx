import {makeSignDoc} from '@cosmjs/amino';
import {toBinary} from '@cosmjs/cosmwasm-stargate';
import {coins} from '@cosmjs/stargate';
import React from 'react';
import {Save, Trash} from 'react-bootstrap-icons';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';
import Table from 'react-bootstrap/Table';

import Ward, {
  EXECUTE_MSG_TYPE_URL,
  FACTORY_CONTRACT_ADDRESS,
  HOST_CHAIN,
  SLAVE_CHAINS,
} from '../internal/ward';

export class BalanceRow extends React.Component {
  render() {
    const {denom, amount} = this.props;
    return (
      <Button
        onClick={() => this.props.openTransferScreen(denom)}
        className="fs-4 my-1"
        disabled={amount <= 0}
        variant={amount > 0 ? 'success' : 'secondary'}
        title={`Transfer ${denom}`}
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
                    placeholder={`${HOST_CHAIN.prefix}1...`}
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
                  disabled={this.state.inProgress || this.state.txHash}
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
    this._asyncRequest = new Ward()
      .getAllBalances()
      .then((balances) => {
        this._asyncRequest = null;
        if (balances) this.setState({balances});
        else this.setState({balances: [], error: 'Failed to fetch balances.'});
      })
      .catch((ex) => this.setState({error: ex.toString()}));
  }
  componentWillUnmount() {
    if (this._asyncRequest) this._asyncRequest.cancel();
  }

  render() {
    return (
      <div className="h-100 d-flex flex-column justify-content-between">
        <div>
          {this.state.error && (
            <Alert variant="danger">{this.state.error}</Alert>
          )}
          <h1 className="fs-3 pb-1 pt-3">Available Balances:</h1>
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
                      <div className="d-flex flex-column">
                        <h3
                          style={{overflow: 'hidden', textOverflow: 'ellipsis'}}
                          className="fs-6"
                          title={chain.address}
                        >
                          {chain.address}
                        </h3>
                        {chain.balances
                          .toSorted((a, b) => b.amount - a.amount)
                          .map(({denom, amount}) => (
                            <BalanceRow
                              key={i}
                              denom={denom}
                              amount={amount}
                              openTransferScreen={(denom) =>
                                this.props.openTransferScreen(
                                  denom,
                                  chain.chainId,
                                )
                              }
                            />
                          ))}
                      </div>
                    </Tab.Pane>
                  ))}
                </Tab.Content>
              </Col>
            </Row>
          </Tab.Container>
        </div>
        <Row>
          <hr />
          <div className="pb-3 d-flex justify-content-around">
            <Button
              variant="primary"
              type="button"
              title="Manage your own account"
              onClick={this.props.openManageOwn}
            >
              Manage own
            </Button>
            <Button
              variant="secondary"
              type="button"
              title="Manage other person account"
              onClick={this.props.openManageOther}
            >
              Manage other
            </Button>
          </div>
        </Row>
      </div>
    );
  }
}

export class MessageSender extends React.Component {
  async sendMessage(msg, contract) {
    const {chainId} = HOST_CHAIN;
    const wrapped = {
      typeUrl: EXECUTE_MSG_TYPE_URL,
      value: {
        sender: await this.ward.getLocalAddress(),
        contract,
        msg: toBinary(msg),
        funds: [],
      },
    };
    const fee = {amount: [], gas: '400000'};
    const signed = await this.ward.signSimpleAsSelf(
      chainId,
      wrapped,
      fee,
      null,
      this.state.password,
    );
    try {
      const result = await this.ward.broadcastRaw(chainId, signed);
      console.log(result);
      try {
        // If this succeeded, we're all set, transaction was sent.
        // this.setState({txHash: result.transactionHash});
        return JSON.parse(result.rawLog);
      }
      catch (ex) {
        const exStr = ex.toString();
        if (exStr.includes('Error parsing into type')) {
          this.setState({
            error:
              'Creation failed. Please make sure that addresses are valid.',
          });
        }
        else {
          this.setState({error: result?.rawLog ?? 'Broadcasting failed.'});
        }
        ex.handled = true;
        throw ex;
      }
    }
    catch (ex) {
      if (!ex.handled) this.setState({error: ex.toString()});
      throw ex;
    }
  }

  requirePassword() {
    if (!this.state.password) {
      this.setState({error: 'Please fill in your password.'});
      return true;
    }
  }
}

export class ManageOwnScreen extends MessageSender {
  state = {
    recoveryPool: [],
    newRecoveryMember: '',
    newOwner: '',
    password: '',
    error: null,
    txHash: null,
    inProgress: false,
    transferInProgress: true,
  };

  constructor(props) {
    super(props);
    this.ward = new Ward();
  }

  async componentDidMount() {
    const {
      members,
      recovery_approvals_count,
      transfer_approvals_count,
      recovery_progress,
      recovery_method,
      new_owner,
    } = await this.ward.getRecoveryState();
    this.setState({
      recoveryPool: members,
      transferInProgress: recovery_method != null,
      newOwner: new_owner || '',
    });
  }

  async saveRecoveryMember() {
    if (this.requirePassword()) return;
    this.setState({error: null, inProgress: true});
    try {
      await this.sendMessage(
        {
          add_recovery_member: {member: this.state.newRecoveryMember},
        },
        await this.ward.getHostContract(),
      );
    }
    catch (ex) {
      return;
    }
    this.props.back();
  }
  async removeRecoveryMember(addr) {
    if (this.requirePassword()) return;
    this.setState({error: null, inProgress: true});
    try {
      await this.sendMessage(
        {
          remove_recovery_member: {member: addr},
        },
        await this.ward.getHostContract(),
      );
    }
    catch (ex) {
      return;
    }
    this.props.back();
  }
  async transferOwnership() {
    if (this.requirePassword()) return;
    this.setState({error: null, inProgress: true});
    try {
      await this.sendMessage(
        {
          begin_transfer_ownership: {target_addr: this.state.newOwner},
        },
        await this.ward.getHostContract(),
      );
    }
    catch (ex) {
      return;
    }
    this.props.back();
  }

  render() {
    return (
      <div className="d-flex flex-column h-100">
        <Row className="py-3">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <h1 className="fs-5" style={{textAlign: 'center'}}>
                Manage own account
              </h1>
              <Button variant="secondary" onClick={this.props.back}>
                Back
              </Button>
            </div>
          </Col>
        </Row>

        <Table
          style={{maxWidth: '100%', tableLayout: 'fixed'}}
          striped
          bordered
          hover
          responsive
        >
          <thead>
            <tr>
              <th style={{width: '80%'}}>Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {this.state.recoveryPool.map((addr) => (
              <tr key={addr}>
                <td
                  style={{overflow: 'hidden', textOverflow: 'ellipsis'}}
                  title={addr}
                >
                  {addr}
                </td>
                <td>
                  <Button
                    title="Remove"
                    variant="danger"
                    type="button"
                    onClick={() => this.removeRecoveryMember(addr)}
                    disabled={this.state.inProgress}
                  >
                    {this.state.inProgress ? (
                      <Spinner animation="border" variant="light" />
                    ) : (
                      <Trash />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <Form.Control
                  autoFocus
                  type="text"
                  id="new-recovery-member"
                  className="w-auto"
                  placeholder={`${HOST_CHAIN.prefix}1...`}
                  value={this.state.newRecoveryMember}
                  onChange={(ev) =>
                    this.setState({newRecoveryMember: ev.target.value})
                  }
                />
              </td>
              <td>
                <Button
                  title="Save"
                  variant="success"
                  type="button"
                  onClick={this.saveRecoveryMember.bind(this)}
                  disabled={this.state.inProgress}
                >
                  {this.state.inProgress ? (
                    <Spinner animation="border" variant="light" />
                  ) : (
                    <Save />
                  )}
                </Button>
              </td>
            </tr>
          </tbody>
        </Table>

        <hr />

        <Row className="align-items-center">
          <Col xs={8}>
            <FloatingLabel
              label="Transfer ownership"
              controlId="transfer-destination"
            >
              <Form.Control
                type="text"
                placeholder={`${HOST_CHAIN.prefix}1...`}
                value={this.state.newOwner}
                onChange={(ev) => this.setState({newOwner: ev.target.value})}
                disabled={this.state.transferInProgress}
              />
            </FloatingLabel>
          </Col>
          <Col xs={4} className="h-100 d-flex">
            <Button
              title="Transfer the wallet to another account"
              variant="danger"
              type="button"
              className="w-100"
              onClick={this.transferOwnership.bind(this)}
              disabled={this.state.transferInProgress || this.state.inProgress}
            >
              {this.state.inProgress && !this.state.transferInProgress ? (
                <Spinner animation="border" variant="light" />
              ) : (
                'Transfer'
              )}
            </Button>
          </Col>
        </Row>

        <div className="d-flex flex-grow-1"></div>

        <FloatingLabel
          className="mb-3"
          label="Password"
          controlId="manage-own-password"
        >
          <Form.Control
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={this.state.password}
            onChange={(ev) => this.setState({password: ev.target.value})}
          />
        </FloatingLabel>
        {this.state.error && <Alert variant="danger">{this.state.error}</Alert>}
        {this.state.txHash && (
          <Alert variant="success">
            <Alert.Heading>Transaction sent!</Alert.Heading>
            <span style={{fontSize: '0.55rem'}}>{this.state.txHash}</span>
          </Alert>
        )}
      </div>
    );
  }
}

export class ManageOtherScreen extends MessageSender {
  state = {
    newOwner: '',
    oldOwner: '',
    recoveryMethod: 'begin_social_recovery',
    password: '',
    error: null,
    txHash: null,
    inProgress: false,
  };

  constructor(props) {
    super(props);
    this.ward = new Ward();
  }

  async handleSubmit(ev) {
    ev.preventDefault();
    if (this.requirePassword()) return;
    this.setState({error: null, inProgress: true});
    try {
      await this.sendMessage(
        {
          [this.state.recoveryMethod]: {target_addr: this.state.newOwner},
        },
        await Ward.getHostContract(this.state.oldOwner),
      );
    }
    catch (ex) {
      return;
    }
    this.props.back();
  }

  render() {
    return (
      <div>
        <Row className="py-3">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <h1 className="fs-5" style={{textAlign: 'center'}}>
                Manage other account
              </h1>
              <Button variant="secondary" onClick={this.props.back}>
                Back
              </Button>
            </div>
          </Col>
        </Row>
        <Form
          onSubmit={this.handleSubmit.bind(this)}
          className="d-grid"
          style={{gridTemplateColumns: '100%', rowGap: '1rem'}}
        >
          <FloatingLabel
            label="Recovery action"
            controlId="manage-other-method"
          >
            <Form.Select
              type="text"
              placeholder={`${HOST_CHAIN.prefix}1...`}
              value={this.state.recoveryMethod}
              onChange={(ev) =>
                this.setState({recoveryMethod: ev.target.value})
              }
            >
              <option value="begin_social_recovery">
                Begin social recovery
              </option>
              <option value="approve_social_recovery">
                Approve social recovery
              </option>
              <option value="approve_transfer_ownership">
                Approve ownership transfer
              </option>
            </Form.Select>
          </FloatingLabel>

          <FloatingLabel label="Current owner" controlId="manage-other-source">
            <Form.Control
              type="text"
              placeholder={`${HOST_CHAIN.prefix}1...`}
              value={this.state.oldOwner}
              onChange={(ev) => this.setState({oldOwner: ev.target.value})}
            />
          </FloatingLabel>

          <FloatingLabel
            label="Transfer beneficiary"
            controlId="manage-other-destination"
          >
            <Form.Control
              type="text"
              placeholder={`${HOST_CHAIN.prefix}1...`}
              value={this.state.newOwner}
              onChange={(ev) => this.setState({newOwner: ev.target.value})}
            />
          </FloatingLabel>

          <FloatingLabel
            className="mb-3"
            label="Password"
            controlId="manage-other-password"
          >
            <Form.Control
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={this.state.password}
              onChange={(ev) => this.setState({password: ev.target.value})}
            />
          </FloatingLabel>
          {this.state.error && (
            <Alert variant="danger">{this.state.error}</Alert>
          )}
          {this.state.txHash && (
            <Alert variant="success">
              <Alert.Heading>Transaction sent!</Alert.Heading>
              <span style={{fontSize: '0.55rem'}}>{this.state.txHash}</span>
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
        </Form>
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
            openManageOwn={() => this.setState({step: 'manageOwn'})}
            openManageOther={() => this.setState({step: 'manageOther'})}
          />
        )}
        {this.state.step === 'transfer' && (
          <TransferScreen
            back={() => this.setState({step: 'balances'})}
            denom={this.state.denom}
            chainId={this.state.chainId}
          />
        )}
        {this.state.step === 'manageOwn' && (
          <ManageOwnScreen back={() => this.setState({step: 'balances'})} />
        )}
        {this.state.step === 'manageOther' && (
          <ManageOtherScreen back={() => this.setState({step: 'balances'})} />
        )}
      </>
    );
  }
}
