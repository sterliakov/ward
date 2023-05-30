import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';

import Ward from '../internal/ward';

export default class FirstStep extends React.Component {
  state = {
    password: '',
    error: null,
    hasAccount: false,
  };

  async componentDidMount() {
    const hasAccount = await Ward.hasAccount();
    this.setState({hasAccount});
  }

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
              {this.state.hasAccount ? 'Welcome back!' : 'Welcome!'}
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
                {/*TODO: floating label */}
                {this.state.hasAccount && (
                  <>
                    <FloatingLabel
                      label="Password"
                      className="mb-3"
                      controlId="formBasicPassword"
                    >
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
                    </FloatingLabel>
                    <Button variant="primary" type="submit">
                      Unlock
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  type="button"
                  onClick={this.props.beginCreateNew}
                >
                  New account
                </Button>
                {this.state.error && (
                  <Alert variant="danger">{this.state.error}</Alert>
                )}
              </div>
            </Form>
          </Col>
        </Row>
      </div>
    );
  }
}
