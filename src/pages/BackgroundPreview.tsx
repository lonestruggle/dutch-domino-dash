import dominoTable1 from "@/assets/domino-table-1.webp";
import dominoTable2 from "@/assets/domino-table-2.webp";
import dominoTable3 from "@/assets/domino-table-3.webp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BackgroundPreview = () => {
  const backgrounds = [
    { id: 1, src: dominoTable1, title: "Mahonie Hout Tafel", description: "Rijke mahonie textuur met gepolijste afwerking" },
    { id: 2, src: dominoTable2, title: "Walnoothout Tafel", description: "Elegante donkere walnoothout met warme verlichting" },
    { id: 3, src: dominoTable3, title: "Eiken Gaming Tafel", description: "Klassieke donkere eiken met natuurlijke houtnerf" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Kies je Domino Tafel Achtergrond</h1>
        
        <div className="grid md:grid-cols-1 gap-8">
          {backgrounds.map((bg) => (
            <Card key={bg.id} className="p-6">
              <h3 className="text-xl font-semibold mb-2">{bg.title}</h3>
              <p className="text-muted-foreground mb-4">{bg.description}</p>
              
              <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden border">
                <img 
                  src={bg.src} 
                  alt={bg.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="mt-4 flex justify-center">
                <Button 
                  onClick={() => alert(`Je hebt ${bg.title} gekozen! Vertel me dit in de chat.`)}
                  className="w-full md:w-auto"
                >
                  Kies Deze Achtergrond
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BackgroundPreview;