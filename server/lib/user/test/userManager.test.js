require('co-mocha');
const ba = require('blockapps-rest');
const rest = ba.rest;
const common = ba.common;
const config = common.config;
const util = common.util;
const should = common.should;
const assert = common.assert;
const constants = common.constants;
const BigNumber = common.BigNumber;
const Promise = common.Promise;

const user = require('../user');
const userManager = require('../userManager');
const ErrorCodes = rest.getEnums(`${config.libPath}/common/ErrorCodes.sol`).ErrorCodes;
const UserRole = rest.getEnums(`${config.libPath}/user/contracts/UserRole.sol`).UserRole;

const adminName = util.uid('Admin');
const adminPassword = '1234';

describe('UserManager tests', function() {
  this.timeout(config.timeout);

  var admin;
  var contract;

  // get ready:  admin-user and manager-contract
  before(function* () {
    admin = yield rest.createUser(adminName, adminPassword);
    contract = yield userManager.uploadContract(admin);
    // compile if needed
    const isCompiled = yield userManager.isCompiled();
    if (!isCompiled) {
      const result = yield userManager.compileSearch();
    }
  });

  it('Create User', function* () {
    const args = createUserArgs();
    const baUser = yield userManager.createUser(admin, contract, args);
    assert.equal(baUser.username, args.username, 'username');
    assert.equal(baUser.role, args.role, 'role');
  });

  it('Test exists()', function* () {
    const args = createUserArgs();

    var exists;
    // should not exist
    exists = yield userManager.exists(admin, contract, args.username);
    assert.isDefined(exists, 'should be defined');
    assert.isNotOk(exists, 'should not exist');
    // create user
    const user = yield userManager.createUser(admin, contract, args);
    // should exist
    exists = yield userManager.exists(admin, contract, args.username);
    assert.equal(exists, true, 'should exist')
  });

  it('Create Duplicate User', function* () {
    const args = createUserArgs();

    // create user
    const user = yield userManager.createUser(admin, contract, args);
    try {
      // create duplicate - should fail
      const duplicateUser = yield userManager.createUser(admin, contract, args);
      // did not FAIL - that is an error
      assert.isUndefined(duplicateUser, `Duplicate username was not detected: ${args.username}`);
    } catch(error) {
      // error should be EXISTS
      const errorCode = error.message;
      // if not - throw
      if (errorCode != ErrorCodes.EXISTS) {
        throw error;
      }
    }
  });

  it('Get User', function *() {
    const args = createUserArgs();

    // get non-existing user
    try {
      const baUser = yield userManager.getUser(admin, contract, args.username);
      // did not FAIL - that is an error
      assert.isUndefined(baUser, `User should not be found ${args.username}`);
    } catch(error) {
      // error should be NOT_FOUND
      const errorCode = error.message;
      // if not - throw
      if (errorCode != ErrorCodes.NOT_FOUND) {
        throw error;
      }
    }

    // create user
    yield userManager.createUser(admin, contract, args);
    // get user - should exist
    const baUser = yield userManager.getUser(admin, contract, args.username);
    assert.equal(baUser.username, args.username, 'username should be found');
  });

  it('Get Users', function* () {
    const args = createUserArgs();

    // get users - should not exist
    {
      const users = yield userManager.getUsers(admin, contract);
      const found = users.filter(function(user) {
        return user.username === args.username;
      });
      assert.equal(found.length, 0, 'user list should NOT contain ' + args.username);
    }
    // create user
    const user = yield userManager.createUser(admin, contract, args);
    // get user - should exist
    {
      const users = yield userManager.getUsers(admin, contract);
      const found = users.filter(function(user) {
        return user.username === args.username;
      });
      assert.equal(found.length, 1, 'user list should contain ' + args.username);
    }
  });

  it.only('User Login', function* () {
    const args = createUserArgs();

    // auth non-existing - should fail
    {
      const result = yield userManager.login(admin, contract, args);
      assert.isDefined(result, 'auth result should be defined');
      assert.isNotOk(result, 'auth should fail');
    }

    // create user
    const user = yield userManager.createUser(admin, contract, args);
    // auth
    {
      const result = yield userManager.login(admin, contract, args);
      assert.isOk(result, 'auth should be ok');
    }
  });
  //
  // it('Get account', function(done) {
  //   const buyer = 'Buyer1';
  //   const supplier = 'Supplier1';
  //   const password = util.uid('Pass');
  //
  //   rest.setScope(scope)
  //     // create buyer/seller
  //     .then(userManager.createUser(adminName, buyer, password, UserRole.BUYER))
  //     .then(function(scope) {
  //       const user = scope.result;
  //       return userManager.getAccount(user.account)(scope);
  //     })
  //     .then(function(scope) {
  //       const account = scope.result;
  //       const balance = new BigNumber(account.balance);
  //       const faucetBalance = new BigNumber(1000).times(constants.ETHER);
  //       balance.should.be.bignumber.equal(faucetBalance);
  //       done();
  //     }).catch(done);
  // });
  //
  // it('Get balance', function(done) {
  //   const buyer = util.uid('Buyer');
  //   const password = util.uid('Pass');
  //
  //   rest.setScope(scope)
  //     // create buyer/seller
  //     .then(userManager.createUser(adminName, buyer, password, UserRole.BUYER))
  //     .then(userManager.getBalance(adminName, buyer))
  //     .then(function(scope) {
  //       const balance = scope.result;
  //       const faucetBalance = new BigNumber(1000).times(constants.ETHER);
  //       balance.should.be.bignumber.equal(faucetBalance);
  //       done();
  //     }).catch(done);
  // });
  //
  // it('Send funds', function(done) {
  //   const buyer = util.uid('Buyer');
  //   const supplier = util.uid('Supplier');
  //   const password = util.uid('Pass');
  //   const valueEther = 12;
  //
  //   scope.balances = {};
  //
  //   rest.setScope(scope)
  //     // SETUP: create buyer/seller
  //     .then(userManager.createUser(adminName, buyer, password, UserRole.BUYER))
  //     .then(userManager.getBalance(adminName, buyer))
  //     .then(function(scope) {
  //       const balance = scope.result;
  //       scope.balances[buyer] = balance;
  //       return scope;
  //     })
  //     .then(userManager.createUser(adminName, supplier, password, UserRole.SUPPLIER))
  //     .then(userManager.getBalance(adminName, supplier))
  //     .then(function(scope) {
  //       const balance = scope.result;
  //       scope.balances[supplier] = balance;
  //       return scope;
  //     })
  //     // TRANSACTION
  //     // get the buyer's info
  //     .then(userManager.getUser(adminName, buyer))
  //     .then(function(scope) {
  //       const buyer = scope.result;
  //       scope.buyer = buyer;
  //       return scope;
  //     })
  //     // get the supplier's info
  //     .then(userManager.getUser(adminName, supplier))
  //     .then(function(scope) {
  //       const supplier = scope.result;
  //       scope.supplier = supplier;
  //       return scope;
  //     })
  //     // send
  //     .then(function(scope) {
  //       //{fromUser, password, fromAddress, toAddress, valueEther, node}
  //       const fromUser = scope.buyer.username;
  //       const fromAddress = scope.buyer.account;
  //       const toAddress = scope.supplier.account;
  //       return rest.sendAddress(fromUser, password, fromAddress, toAddress, valueEther)(scope);
  //     })
  //     // VALIDATE
  //     .then(function(scope) {
  //       // calculate the fee
  //       const txResult = scope.tx.slice(-1)[0].result;
  //       scope.fee = new BigNumber(txResult.gasLimit).times(new BigNumber(txResult.gasPrice));
  //       return scope;
  //     })
  //    .then(util.delayPromise(1000*10))
  //     // check supplier
  //     .then(userManager.getBalance(adminName, supplier))
  //     .then(function(scope) {
  //       const balance = scope.result;
  //       const delta = balance.minus(scope.balances[supplier]);
  //       const expectedDelta = constants.ETHER.mul(valueEther);
  //       delta.should.be.bignumber.equal(expectedDelta);
  //       return scope;
  //     })
  //     // check buyer
  //     .then(userManager.getBalance(adminName, buyer))
  //     .then(function(scope) {
  //       const balance = scope.result;
  //       const delta = balance.minus(scope.balances[buyer]);
  //       const expectedDelta = constants.ETHER.mul(valueEther).plus(scope.fee).mul(-1);
  //       delta.should.be.bignumber.gte(expectedDelta);
  //       return scope;
  //     })
  //     .then(function(scope) {
  //       done();
  //     }).catch(done);
  // });

});

// function createUser(address account, string username, bytes32 pwHash, UserRole role) returns (ErrorCodes) {
function createUserArgs() {
  const uid = util.uid();
  const args = {
    username: 'User' + uid,
    password: 'Pass' + uid,
    role: UserRole.SUPPLIER,
  }
  return args;
}
