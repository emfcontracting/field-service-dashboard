// app/dashboard/components/WorkOrdersFilters.js
'use client';

export default function WorkOrdersFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  onNewWorkOrder,
  onImport,     
  exportDropdown
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="🔍 Search WO#, Building, Description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[250px] bg-gray-700 text-white px-4 py-2 rounded-lg"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="needs_return">Needs Return</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="emergency">Emergency</option>
        </select>

        <button
          onClick={onNewWorkOrder}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          + New Work Order
        </button>

        <button
          onClick={onImport}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          📥 Import
        </button>
		
		{exportDropdown}
      </div>
    </div>
  );
}