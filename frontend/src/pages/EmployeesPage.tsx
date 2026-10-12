import React from 'react';
import { EmployeeTable } from '../components/employees/EmployeeTable';

export const EmployeesPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <EmployeeTable />
    </div>
  );
};
