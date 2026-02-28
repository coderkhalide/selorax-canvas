import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const AnalyticsView: React.FC = () => {
    const data = [
        { name: 'Views', value: 12400 },
        { name: 'Clicks', value: 4300 },
        { name: 'Leads', value: 1200 },
        { name: 'Sales', value: 340 }
    ];

    return (
        <div className="flex-1 overflow-auto p-8 bg-gray-50 text-gray-900 flex flex-col items-center">
            <div className="w-full max-w-5xl space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {data.map((item) => (
                        <div key={item.name} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-gray-500 text-sm font-medium mb-1">{item.name}</p>
                            <p className="text-3xl font-bold text-gray-900">{item.value.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
                    <h2 className="text-xl font-bold mb-6 text-gray-900">Conversion Metrics</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" stroke="#6b7280" />
                                <YAxis stroke="#6b7280" />
                                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', color: '#111827' }} cursor={{ fill: '#f3f4f6', opacity: 0.4 }} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};
