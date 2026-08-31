import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

// FR-AUTH-04: "configurable password policy (minimum length/complexity)".
// Minimum length is read from PASSWORD_MIN_LENGTH (falls back to 8) so it is
// actually configurable per environment, not hardcoded; complexity requires
// at least one uppercase letter, one lowercase letter and one digit.
const MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH) || 8;
const COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

@ValidatorConstraint({ name: 'strongPassword', async: false })
class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && value.length >= MIN_LENGTH && COMPLEXITY.test(value);
  }

  defaultMessage(): string {
    return `Password must be at least ${MIN_LENGTH} characters long and include an uppercase letter, a lowercase letter and a digit.`;
  }
}

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}
