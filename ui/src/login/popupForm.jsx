import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Row from 'react-bootstrap/Row';
import Tab from 'react-bootstrap/Tab';

import init from '../content/init';
import {highlightJSON} from '../internal/utils';
import Ward, {DEBUG, request} from '../internal/ward';

class FirstStep extends React.Component {
  state = {
    password: '',
    error: null,
  };

  async handleSubmit(ev) {
    ev.preventDefault();
    try {
      await new Ward().getAccountWithPrivkey(this.state.password);
    }
    catch (ex) {
      this.setState({error: 'Incorrect password.'});
      return;
    }
    this.props.continueUnlocked();
  }

  render() {
    return (
      <div className="h-100 d-flex flex-column justify-content-between">
        <Row className="py-3">
          <Col>
            <h1 style={{fontSize: '3rem', textAlign: 'center'}}>
              Welcome back!
            </h1>
          </Col>
        </Row>
        <Row className="py-3">
          <Col>
            <Form onSubmit={this.handleSubmit.bind(this)}>
              <div
                className="d-grid"
                style={{gridTemplateColumns: '100%', rowGap: '6px'}}
              >
                <Form.Group className="mb-3" controlId="formBasicPassword">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    autoFocus
                    type="password"
                    autoComplete="password"
                    placeholder="Password"
                    value={this.state.password}
                    onChange={(ev) =>
                      this.setState({password: ev.target.value})
                    }
                  />
                </Form.Group>
                {this.state.error && (
                  <Alert variant="danger">{this.state.error}</Alert>
                )}
                <Button variant="primary" type="submit">
                  Unlock
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={this.props.beginCreateNew}
                >
                  New account
                </Button>
              </div>
            </Form>
          </Col>
        </Row>
      </div>
    );
  }
}

class BalanceRow extends React.Component {
  render() {
    const {denom, amount} = this.props;
    return (
      <div className="fs-4">
        <Badge bg={amount > 0 ? 'success' : 'secondary'}>
          {amount}
          <span className="ps-2 text-uppercase">{denom}</span>
        </Badge>
      </div>
    );
  }
}

class AccountState extends React.Component {
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
                  <Nav.Item>
                    <Nav.Link eventKey={i}>{chain.name}</Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>
            </Col>
            <Col xs={9}>
              <Tab.Content>
                {this.state.balances.map((chain, i) => (
                  <Tab.Pane eventKey={i}>
                    {chain.balances.map(({denom, amount}) => (
                      <BalanceRow denom={denom} amount={amount} />
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
        {this.state.step === 'balances' && <AccountState />}
      </>
    );
  }
}
