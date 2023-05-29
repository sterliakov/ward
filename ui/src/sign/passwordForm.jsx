import React from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

import init from '../content/init';
import {highlightJSON} from '../internal/utils';
import Ward, {request} from '../internal/ward';

export default class PasswordForm extends React.Component {
  state = {
    password: '',
    error: null,
    tx: null,
    signMode: null,
    who: null,
  };

  async handleSubmit(ev) {
    console.log(this.state);
    ev.preventDefault();
    let signed;
    try {
      signed = await new Ward().sign(
        this.state.who,
        this.state.tx,
        this.state.signMode,
        this.state.password,
      );
      console.log(signed);
    }
    catch (ex) {
      console.error(ex);
      this.setState({error: 'Incorrect password.'});
      return;
    }
    await request({...signed, type: 'signDeliver'});
    window.close();
  }

  componentDidMount() {
    init();
  }

  static getDerivedStateFromProps(props, state = {}) {
    const searchParams = new URL(window.location.href).searchParams;
    const {tx, signMode, who} = Object.fromEntries(searchParams.entries());
    console.log(tx, signMode, who);

    return {...state, tx: JSON.parse(tx), signMode, who};
  }

  render() {
    return (
      <Form onSubmit={this.handleSubmit.bind(this)}>
        <Alert variant="warning">
          <Alert.Heading>
            You&apos;re about to sign the following transaction:
          </Alert.Heading>
          <pre
            className="pretty-json"
            dangerouslySetInnerHTML={{__html: highlightJSON(this.state.tx)}}
          />
        </Alert>
        <Form.Group className="mb-3" controlId="formBasicPassword">
          <Form.Label>Password</Form.Label>
          <Form.Control
            autoFocus
            type="password"
            autoComplete="password"
            placeholder="Password"
            value={this.state.password}
            onChange={(ev) => this.setState({password: ev.target.value})}
          />
        </Form.Group>
        {this.state.error && <Alert variant="danger">{this.state.error}</Alert>}
        <Button variant="primary" type="submit">
          Submit
        </Button>
      </Form>
    );
  }
}
