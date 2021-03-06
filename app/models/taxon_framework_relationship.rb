class TaxonFrameworkRelationship < ActiveRecord::Base
  alias_attribute :internal_taxa, :taxa
  
  belongs_to :user
  belongs_to :updater, class_name: "User"
  belongs_to :taxon_framework
  has_many :external_taxa, dependent: :destroy
  has_many :taxa, before_add: :check_if_covered, dependent: :nullify
  
  accepts_nested_attributes_for :external_taxa, allow_destroy: true
  accepts_nested_attributes_for :taxa
  
  before_save :set_relationship
  before_validation :mark_external_taxa_for_destruction 
  
  validates :taxon_framework, presence: true
  validate :taxon_framework_has_source
  
  RELATIONSHIPS = [
    "match",
    "one_to_one",
    "alternate_position",
    "many_to_many",
    "many_to_one",
    "one_to_many",
    "not_external",
    "not_internal",
    "unknown"
  ]
  
  TAXON_JOINS = [
    "LEFT OUTER JOIN taxa t ON t.taxon_framework_relationship_id = taxon_framework_relationships.id"
  ]
  
  scope :relationships, lambda { |relationships| where( "taxon_framework_relationships.relationship IN (?)", relationships ) }
  scope :taxon_framework, lambda{ |taxon_framework| where("taxon_framework_relationships.taxon_framework_id = ?", taxon_framework ) }
  scope :by, lambda{ |user| where( user_id: user ) }
  scope :active, -> {
    joins( TAXON_JOINS ).
    where( "t.is_active = true" )
  }
  scope :inactive, -> {
    joins( TAXON_JOINS ).
    where( "t.is_active = false" )
  }
  scope :rank, lambda { |rank|
    joins( TAXON_JOINS ).
    where( "t.rank = ?", rank )
  }
  scope :taxon, lambda{|taxon|
    joins(TAXON_JOINS).
    where( "t.id = ? OR t.ancestry LIKE (?) OR t.ancestry LIKE (?)", taxon.id, "%/#{ taxon.id }", "%/#{ taxon.id }/%" )
  }
  
  def mark_external_taxa_for_destruction
    external_taxa.each do |external_taxon|
      if external_taxon.name.blank?
        external_taxon.mark_for_destruction
      end
    end
  end
  
  def taxon_framework_has_source
    errors.add :taxon_framework_id, "taxon framework must have source" unless taxon_framework.source_id.present?
  end
  
  def taxa_covered_by_taxon_framework
    return false unless taxa.map{ |t| t.parent.id == taxon_framework.taxon_id || taxon.upstream_taxon_framework.id == taxon_framework.id }.all?
    true
  end
  
  def check_if_covered(taxon)
    unless taxon.id.nil? || taxon.rank.nil?
      raise if taxon.ancestry.nil?
      raise unless taxon.parent.id == taxon_framework.taxon_id || taxon.upstream_taxon_framework.id == taxon_framework.id
    end
    true
  end
  
  def set_relationship
    external_taxa_count = external_taxa.count
    taxa_count = taxa.count
    if external_taxa_count == 1 && taxa_count == 1
      if external_taxa.first.name == taxa.first.name && 
         external_taxa.first.rank == taxa.first.rank &&
         external_taxa.first.parent_name == taxa.first.parent.name &&
         external_taxa.first.parent_rank.downcase == taxa.first.parent.rank
        self.relationship = "match"
      elsif external_taxa.first.name == taxa.first.name && 
        external_taxa.first.rank == taxa.first.rank &&
        taxa.first.ancestors.map{|a| { name: a.name, rank: a.rank } }.
          select{ |a| a[:name] == external_taxa.first.parent_name && a[:rank] == external_taxa.first.parent_rank.downcase }.
          count > 0
        self.relationship = "match"
      elsif external_taxa.first.name == taxa.first.name && 
         external_taxa.first.rank == taxa.first.rank
        self.relationship = "alternate_position"
      else
        self.relationship = "one_to_one"
      end
    elsif external_taxa_count > 1 && taxa_count > 1
      self.relationship = "many_to_many"
    elsif external_taxa_count > 1 && taxa_count == 1
      self.relationship = "many_to_one"
    elsif external_taxa_count == 1 && taxa_count > 1
      self.relationship = "one_to_many"
    elsif external_taxa_count == 0 && taxa_count == 1
      self.relationship = "not_external"
    elsif external_taxa_count == 1 && taxa_count == 0
      self.relationship = "not_internal"
    else
      self.relationship = "unknown"
    end
    true
  end
  
end
