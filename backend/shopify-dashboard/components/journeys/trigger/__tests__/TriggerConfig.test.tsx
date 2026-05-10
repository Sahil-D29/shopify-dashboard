import { render, screen } from '@testing-library/react';

import { TriggerConfig, initialTriggerConfigState } from '../TriggerConfig';

describe('TriggerConfig', () => {
  it('renders header summary', () => {
    render(<TriggerConfig initialState={initialTriggerConfigState} />);
    expect(screen.getByDisplayValue('New Trigger')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Trigger/i })).toBeDisabled();
  });
});

