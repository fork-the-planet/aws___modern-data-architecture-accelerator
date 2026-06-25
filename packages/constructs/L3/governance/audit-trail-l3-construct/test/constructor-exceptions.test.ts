/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MdaaRoleHelper } from '@aws-mdaa/iam-role-helper';
import { MdaaTestApp } from '@aws-mdaa/testing';
import { AuditTrailL3Construct, AuditTrailL3ConstructProps } from '../lib';

describe('Constructor validation', () => {
  test('Throws when neither trail nor trails is provided', () => {
    const testApp = new MdaaTestApp();
    const stack = testApp.testStack;

    const constructProps: AuditTrailL3ConstructProps = {
      roleHelper: new MdaaRoleHelper(stack, testApp.naming),
      naming: testApp.naming,
    };

    expect(() => new AuditTrailL3Construct(stack, 'teststack', constructProps)).toThrow(
      "At least one of 'trail' or 'trails' must be provided.",
    );
  });
});
