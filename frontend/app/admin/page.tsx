export default function AdminDashboard() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Panel Principal</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="text-gray-500 text-sm font-medium">Total de Negocios</h3>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">0</p>
                </div>
                {/* Placeholder functionality */}
            </div>
        </div>
    );
}
