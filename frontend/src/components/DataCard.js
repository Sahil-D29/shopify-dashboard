const DataCard = ({ title, count }) => (
  <div className="bg-white shadow-md rounded-2xl p-6 text-center">
    <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
    <p className="text-3xl font-bold text-blue-600 mt-2">{count}</p>
  </div>
);

export default DataCard;

